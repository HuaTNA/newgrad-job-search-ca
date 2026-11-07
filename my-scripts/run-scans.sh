#!/bin/zsh
# my-scripts/run-scans.sh -- scheduled scan runner for career-ops (user layer add-on).
#   my-scripts/run-scans.sh quick   # tracked companies (portals.yml), a few minutes
#   my-scripts/run-scans.sh full    # full-ATS sweep without iCIMS/BambooHR, ~1 hour
# After either scan: zero-token prescreen of data/pipeline.md, promote newly found
# Canada-active companies into portals.yml, then a macOS notification with the result.
# Nothing here spends Claude tokens; evaluation stays a manual `/career-ops pipeline`.

MODE="${1:-quick}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# launchd starts with a bare PATH: find node via Homebrew (standard or ~/.homebrew) or nvm.
export PATH="$HOME/.homebrew/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

cd "$ROOT" || exit 1
mkdir -p data/logs
LOG="data/logs/scan-$(date +%Y-%m-%d)-$MODE.log"
exec >>"$LOG" 2>&1
echo "=== $(date) :: $MODE scan ==="
command -v node >/dev/null || { echo "node not found on PATH"; exit 1; }

before=$(grep -c '^- \[ \]' data/pipeline.md 2>/dev/null || echo 0)

if [ "$MODE" = "full" ]; then
  # caffeinate keeps the Mac awake for the ~1h sweep
  caffeinate -i node scan-ats-full.mjs --since 7 --ats greenhouse,lever,ashby,workday | grep -v "ℹ️"
else
  node scan.mjs --since 7
fi

echo "--- prescreen ---"
node my-scripts/prescreen-pipeline.mjs --write

echo "--- promote Canada-active companies ---"
cp portals.yml "data/portals.backup-$(date +%Y-%m-%d).yml"
node my-scripts/promote-canada-companies.mjs --write
node validate-portals.mjs || { echo "portals.yml invalid after promote -- restoring backup"; cp "data/portals.backup-$(date +%Y-%m-%d).yml" portals.yml; }

after=$(grep -c '^- \[ \]' data/pipeline.md 2>/dev/null || echo 0)
new=$((after - before)); [ $new -lt 0 ] && new=0
msg="$MODE scan done: $new new, $after pending. Run /career-ops pipeline."
echo "$msg"
osascript -e "display notification \"$msg\" with title \"career-ops\"" >/dev/null 2>&1
echo "=== done $(date) ==="
