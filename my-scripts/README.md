# my-scripts -- Hua's additions to career-ops

User-layer helpers (career-ops updates never touch this folder). All are zero-token.

| Script | What it does |
|---|---|
| `run-scans.sh quick` | `scan.mjs --since 7` over portals.yml, then prescreen + promote, then a Mac notification |
| `run-scans.sh full` | full-ATS sweep (Greenhouse, Lever, Ashby, Workday; no iCIMS/BambooHR), then the same |
| `prescreen-pipeline.mjs [--write]` | fetches each pending JD from the ATS API and parks hard blockers (>= 3 years required, PhD required, clearance/citizenship) under `## Auto-skipped (prescreen)` in data/pipeline.md |
| `promote-canada-companies.mjs [--write] [--min N]` | adds companies that posted relevant Canadian roles (from data/scan-history.tsv) to portals.yml so the fast scan covers them |
| `install-schedule.sh [--remove]` | installs the schedule: quick scan Mon + Thu 07:10, full sweep Sun 23:10 |

Logs: `data/logs/`. portals.yml backups: `data/portals.backup-*.yml`.

## Weekly rhythm

1. Scans run on their own (or `zsh my-scripts/run-scans.sh quick` by hand).
2. When the notification says there are pending roles, open Claude Code in `~/career-ops` and run `/career-ops pipeline`.
3. Apply to everything marked **APPLY** (score >= 3.5, no hard blocker); decide on **STRETCH** ones.
4. Record every outcome (next section). After 20-30 applications, run `/career-ops patterns`.

## Recording outcomes (so the system can learn)

Say it in Claude Code ("applied to Genesys", "Hootsuite rejected me", "Capital One invited me to an interview"), or run directly:

```bash
node set-status.mjs Genesys Applied            # after submitting
node outcome.mjs Hootsuite rejected            # rejection
node outcome.mjs "Capital One" interview_progress --stage "recruiter screen"
node outcome.mjs Genesys no_response           # ~3 weeks of silence
node followup-cadence.mjs                      # who is due for a follow-up
```

Outcomes: `interview_progress | offer_received | hired | offer_declined | rejected | no_response | interview_only`.
Then `/career-ops patterns` shows which role types, scores and CV versions actually get responses.

## Warm intros (LinkedIn)

1. LinkedIn -> Settings -> Data privacy -> Get a copy of your data -> select **Connections** only -> Request archive (email arrives in ~10 min to a day).
2. Unzip and copy `Connections.csv` to `~/career-ops/data/Connections.csv`.
3. `node linkedin-join.mjs --summary --csv data/Connections.csv` (or ask Claude Code: "who do I know at the companies in my tracker and portals?").
It lists people you already know at companies in your tracker or portals.yml. A referral beats a cold application, so message them before applying.
