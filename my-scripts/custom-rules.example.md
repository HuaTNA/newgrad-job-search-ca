# Example rules for modes/_custom.md (new-grad CVs)

Copy what you want into your own `modes/_custom.md` (git-ignored, never overwritten by updates).
Replace the bracketed parts with your own facts.

- **Preferred CV source.** For every tailored CV, use `latex` mode: select content from cv.md per JD and render with `node build-cv-latex.mjs <payload.json> <out.tex> --template=hua`, then compile with `generate-latex.mjs`. Do not add an availability line. HTML is the fallback only when LaTeX cannot compile.

- **New-grad CV format.** Every tailored CV is exactly one full page.
  - Education first; no Professional Summary, Core Competencies or headline.
  - Main experience: 4-8 bullets, most JD-relevant first. Projects: 2-4, each 1-3 bullets, stack in `context`. Skills: 3-5 lines tuned to the JD.
  - **Fill loop:** after compiling, read `CAREEROPS-PAGEFILL used=X of=Y` from the LaTeX log (printed by the hua template). Target 95-101% of Y on one page. Below 95%: add the next most relevant *supported* content and recompile. Over a page: drop the least relevant bullet, then project. Up to 5 iterations. Never pad with unsupported claims.
  - **Bullet style:** no opening verb used twice; "Independently" at most once; no repeated word inside a bullet; no vague closers ("to keep services reliable"); bold only the 2-3 most striking metrics; skills are plain keywords.
  - Output filename `cv-[your-name]-{company}-{date}.pdf`.

- **Experience length.** Never state or imply a total amount of experience. Describe it only as "[a 12-month co-op]" plus named projects. Never add durations together or echo a JD's years requirement back. Leave numeric "years of experience" form fields for the candidate, flagged.

- **Experience-length review flag.** Every hand-off of a tailored CV/cover letter/form answer ends with an "Experience-length check" section quoting every sentence about duration or tenure, or "None found".

- **New-grad apply bar.** Ignore the generic "below 4.0, don't apply". Score >= 3.5 and no hard blocker -> APPLY; 3.0-3.4 -> STRETCH; < 3.0 or a hard blocker -> SKIP. Hard blockers: >= 3 years required (firm), senior/staff, PhD/Master's required, citizenship/PR/clearance, location outside your market, primary stack absent with no transferable equivalent. Missing secondary tools are gaps to prepare for, not blockers.
