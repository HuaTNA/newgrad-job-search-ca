#!/usr/bin/env node
// my-scripts/prescreen-pipeline.mjs -- user-layer add-on (not part of career-ops core).
//
// Zero-token pre-screen for data/pipeline.md. For every pending URL it pulls the JD body
// from the ATS's public API (career-ops' own fetchJdViaKnownApi: Greenhouse, Lever,
// Ashby, Workday) and parks postings with a HARD blocker for a new grad:
//   - a firm requirement of >= 3 years of experience ("3+ years", "3-5 years", "minimum 4 years")
//   - a required PhD
//   - security clearance / citizenship-only
// Parked items move to "## Auto-skipped (prescreen)" with the reason, so /career-ops pipeline
// never spends tokens on them. Requirements phrased as preferred / nice-to-have / asset are ignored.
// Postings whose JD cannot be fetched stay pending (the LLM triage decides).
//
//   node my-scripts/prescreen-pipeline.mjs            # preview
//   node my-scripts/prescreen-pipeline.mjs --write    # apply
//   node my-scripts/prescreen-pipeline.mjs --self-test
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const MIN_YEARS = 3;

const SOFT = /(prefer|nice[- ]to[- ]have|\bbonus\b|\basset\b|\bplus\b(?! years)|ideally|desired|is an advantage)/i;

export function blockers(text) {
  const reasons = [];
  const sentences = String(text).replace(/\s+/g, ' ').split(/(?<=[.;!?•\n])\s+|\s+[-•*]\s+/);
  for (const s of sentences) {
    if (SOFT.test(s)) continue;
    if (/experience|expérience/i.test(s)) {
      const m = s.match(/(?:minimum|at least|min\.?)?\s*(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|–|to)\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?|ans)\b/i);
      if (m) {
        const lo = Number(m[1]);
        if (lo >= MIN_YEARS && lo <= 20) reasons.push(`requires ${m[0].trim()} experience`);
      }
    }
    if (/\b(ph\.?\s?d|doctorate)\b/i.test(s) && /(required|must|mandatory|requires)/i.test(s) && !/\bor\b[^.]{0,40}(equivalent|master|bachelor)/i.test(s)) {
      reasons.push('PhD required');
    }
    if (/(security clearance|secret clearance|must be a canadian citizen|canadian citizenship (?:is )?required|citizens only)/i.test(s)) {
      reasons.push('clearance/citizenship required');
    }
  }
  return [...new Set(reasons)];
}

function selfTest() {
  const cases = [
    ['Requirements: 3+ years of experience building backend services.', true],
    ['Minimum 5 years experience in Python.', true],
    ['3-5 years of professional experience with Java.', true],
    ['0-2 years of experience; co-ops count.', false],
    ['2+ years of experience preferred.', false],
    ['5+ years of experience is a nice to have.', false],
    ['PhD in Computer Science required.', true],
    ['PhD or equivalent industry experience required.', false],
    ['Must be eligible for Secret security clearance.', true],
    ['Our team has 10 years of history.', false],
  ];
  let ok = 0;
  for (const [t, want] of cases) {
    const got = blockers(t).length > 0;
    console.log(`${got === want ? 'PASS' : 'FAIL'}  ${want ? 'block' : 'keep '}  ${t}${got !== want ? `  -> ${JSON.stringify(blockers(t))}` : ''}`);
    if (got === want) ok++;
  }
  console.log(`${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

async function main() {
  if (args.includes('--self-test')) return selfTest();
  const { fetchJdViaKnownApi } = await import(resolve(ROOT, 'browser-extract.mjs'));
  const p = resolve(ROOT, 'data/pipeline.md');
  const s = readFileSync(p, 'utf-8');
  const [head, rest] = s.split('## Pending');
  if (rest === undefined) { console.error('pipeline.md has no "## Pending" section'); process.exit(1); }
  const [pend, proc = ''] = rest.split('## Processed');
  const lines = pend.split('\n').filter((l) => l.startsWith('- [ ]'));
  if (!lines.length) { console.log('No pending items.'); return; }

  const keep = [], parked = [], unfetched = [];
  let i = 0;
  async function worker() {
    while (i < lines.length) {
      const line = lines[i++];
      const url = line.slice(6).split(' | ')[0].trim();
      let res = null;
      try { res = await fetchJdViaKnownApi(url, 60000, 20000); } catch { res = null; }
      if (!res?.text) { unfetched.push(line); keep.push(line); continue; }
      const why = blockers(`${res.title || ''}. ${res.text}`);
      if (why.length) parked.push(`${line.replace('- [ ]', '- [x]')} | prescreen: ${why.join('; ')}`);
      else keep.push(line);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  console.log(`Pending ${lines.length}: keep ${keep.length} (JD not fetchable: ${unfetched.length}), park ${parked.length}`);
  for (const l of parked) console.log('  - ' + l.slice(6, 220));
  if (!WRITE) { console.log('\nPreview only. Re-run with --write to apply.'); return; }
  if (!parked.length) return;

  let procPart = proc;
  const AUTO = '## Auto-skipped (prescreen)';
  let tail = '';
  if (procPart.includes(AUTO)) {
    const [a, b] = procPart.split(AUTO);
    procPart = a;
    tail = b.replace(/^\s*\n/, '');
  }
  const out = `${head}## Pending\n\n${keep.join('\n')}\n\n## Processed${procPart.replace(/\s*$/, '\n')}\n${AUTO}\n\n${parked.join('\n')}\n${tail}`;
  writeFileSync(p, out);
  console.log(`\nMoved ${parked.length} item(s) to "${AUTO}" in data/pipeline.md.`);
}

main().catch((e) => { console.error('prescreen: ' + (e?.message || e)); process.exit(1); });
