#!/usr/bin/env node
// my-scripts/promote-canada-companies.mjs -- user-layer add-on (not part of career-ops core).
//
// Builds the "Canada-active" watchlist: reads data/scan-history.tsv (every posting
// any scan has ever added), keeps postings that are (a) in Canada, (b) a relevant
// tech/data title, (c) not from a blacklisted company, then derives each company's
// ATS board URL and proposes it as a portals.yml tracked_companies entry -- so the
// fast `node scan.mjs` covers it and the slow full-ATS sweep can run less often.
//
//   node my-scripts/promote-canada-companies.mjs            # preview (writes nothing)
//   node my-scripts/promote-canada-companies.mjs --write    # append new entries to portals.yml
//   node my-scripts/promote-canada-companies.mjs --min 2    # require >= 2 relevant Canadian postings
//
// Zero tokens, zero network. Safe to run after every scan.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const MIN = Number((args[args.indexOf('--min') + 1] ?? '').match(/^\d+$/) ? args[args.indexOf('--min') + 1] : 1);

const CA = ['canada', 'toronto', 'ontario', 'vancouver', 'montreal', 'montréal', 'ottawa', 'calgary',
  'waterloo', 'kitchener', 'edmonton', 'mississauga', 'markham', 'burnaby', 'halifax', 'winnipeg',
  'victoria', 'québec', 'quebec', ', on', ', bc', ', qc', ', ab', ' can'];
const NOT_CA = ['ontario, ca', 'ontario, oh', 'waterloo, ia', ' wi '];
const RELEVANT = /(machine learning|\bml\b|\bai\b|\bllm\b|data scien|data analy|analytics|software|developer|engineer|applied scien|new grad|graduate|early career|strategy analyst)/i;
const NOISE = /(agent(?!ic)|insurance|support|advisor|coordinator|assistant|technician|sales|recruit|nurse|driver|mechanic|electrical|civil|structural|hvac|warehouse|cashier|loss prevention|contributor|annotation|seasonal|mems|protein|faculty|institutional research)/i;
const SENIOR = /(senior|\bsr\.?\b|staff|principal|\blead\b|manager|director|architect|head of|\bvp\b|\biii\b|\biv\b|intermediate|smts|specialist|product owner)/i;

function isCanada(loc) {
  const l = ` ${String(loc || '').toLowerCase()} `;
  return CA.some((k) => l.includes(k)) && !NOT_CA.some((k) => l.includes(k));
}

// posting URL -> { ats, careers_url, api? } for boards scan.mjs can read directly
function boardFor(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const seg = u.pathname.split('/').filter(Boolean).filter((s) => !/^[a-z]{2}-[A-Z]{2}$/.test(s));
  const h = u.hostname;
  if (/greenhouse\.io$/.test(h) && seg[0]) {
    return { ats: 'greenhouse', careers_url: `https://job-boards.greenhouse.io/${seg[0]}`,
      api: `https://boards-api.greenhouse.io/v1/boards/${seg[0]}/jobs` };
  }
  if (h === 'jobs.lever.co' && seg[0]) return { ats: 'lever', careers_url: `https://jobs.lever.co/${seg[0]}` };
  if (h === 'jobs.ashbyhq.com' && seg[0]) return { ats: 'ashby', careers_url: `https://jobs.ashbyhq.com/${seg[0]}` };
  if (/\.myworkdayjobs\.com$/.test(h) && seg[0]) return { ats: 'workday', careers_url: `https://${h}/${seg[0]}` };
  return null; // iCIMS / BambooHR / others: low yield, leave to the full sweep
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// --- inputs
const histPath = resolve(ROOT, 'data/scan-history.tsv');
if (!existsSync(histPath)) { console.error('No data/scan-history.tsv yet -- run a scan first.'); process.exit(1); }
const [header, ...rows] = readFileSync(histPath, 'utf-8').split('\n').filter(Boolean);
const cols = header.split('\t');
const ix = (n) => cols.indexOf(n);

const blPath = resolve(ROOT, 'data/blacklist.md');
const blacklist = new Set(existsSync(blPath)
  ? readFileSync(blPath, 'utf-8').split('\n').filter((l) => /^\|/.test(l) && !/Company|---/.test(l))
    .map((l) => norm(l.split('|')[1]))
  : []);

const portalsPath = resolve(ROOT, 'portals.yml');
const portalsText = readFileSync(portalsPath, 'utf-8');
const portals = yaml.load(portalsText);
const known = new Set();
for (const c of portals.tracked_companies || []) {
  known.add(norm(c.name));
  if (c.careers_url) known.add(c.careers_url.replace(/\/+$/, '').toLowerCase());
}

// --- aggregate
const found = new Map();
for (const r of rows) {
  const f = r.split('\t');
  const url = f[ix('url')], title = f[ix('title')], company = f[ix('company')], loc = f[ix('location')];
  if (!url || !isCanada(loc)) continue;
  if (!RELEVANT.test(title) || NOISE.test(title) || SENIOR.test(title)) continue;
  if (blacklist.has(norm(company))) continue;
  const b = boardFor(url);
  if (!b) continue;
  const key = b.careers_url.toLowerCase();
  if (known.has(key) || known.has(norm(company))) continue;
  const e = found.get(key) || { company, ...b, titles: [] };
  e.titles.push(title);
  found.set(key, e);
}
const picks = [...found.values()].filter((e) => e.titles.length >= MIN)
  .sort((a, b) => b.titles.length - a.titles.length);

if (picks.length === 0) { console.log('No new Canada-active companies to add.'); process.exit(0); }

console.log(`${picks.length} new Canada-active compan${picks.length === 1 ? 'y' : 'ies'} (>= ${MIN} relevant Canadian posting${MIN === 1 ? '' : 's'}):\n`);
for (const p of picks) console.log(`  + ${p.company.padEnd(28)} ${p.ats.padEnd(10)} ${p.careers_url}\n      e.g. ${p.titles.slice(0, 3).join(' | ')}`);

if (!WRITE) { console.log('\nPreview only. Re-run with --write to append these to portals.yml.'); process.exit(0); }

const today = new Date().toISOString().slice(0, 10);
const block = picks.map((p) => [
  `  - name: ${JSON.stringify(p.company)}`,
  `    careers_url: ${p.careers_url}`,
  ...(p.api ? [`    api: ${p.api}`] : []),
  `    notes: ${JSON.stringify(`Auto-promoted ${today} by my-scripts/promote-canada-companies.mjs (${p.ats}); e.g. ${p.titles.slice(0, 2).join(' | ')}`)}`,
  '    enabled: true',
].join('\n')).join('\n\n');
writeFileSync(portalsPath, `${portalsText.replace(/\s*$/, '')}\n\n  # -- Canada-active, auto-promoted ${today} --\n\n${block}\n`);
console.log(`\nAppended ${picks.length} entr${picks.length === 1 ? 'y' : 'ies'} to portals.yml. Run: node validate-portals.mjs`);
