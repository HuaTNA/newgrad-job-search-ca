#!/bin/zsh
# my-scripts/install-schedule.sh -- install (or remove) the scheduled career-ops scans.
#   zsh my-scripts/install-schedule.sh            # install
#   zsh my-scripts/install-schedule.sh --remove   # uninstall
# Schedule (local time): quick scan Mon + Thu 07:10; full sweep Sun 23:10.
# If the Mac is asleep at that time, launchd runs the job when it wakes.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="com.$(id -un | tr -cd 'a-zA-Z0-9').careerops"
AGENTS="$HOME/Library/LaunchAgents"
UID_=$(id -u)
chmod +x "$ROOT/my-scripts/run-scans.sh"
mkdir -p "$AGENTS" "$ROOT/data/logs"

write_plist() { # label mode calendar-xml
  cat > "$AGENTS/$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$ROOT/my-scripts/run-scans.sh</string><string>$2</string></array>
  <key>StartCalendarInterval</key>
  $3
  <key>StandardOutPath</key><string>$ROOT/data/logs/launchd-$2.out</string>
  <key>StandardErrorPath</key><string>$ROOT/data/logs/launchd-$2.err</string>
</dict>
</plist>
EOF
}

for L in $PREFIX.quick $PREFIX.full; do
  launchctl bootout "gui/$UID_/$L" 2>/dev/null
  [ "$1" = "--remove" ] && rm -f "$AGENTS/$L.plist"
done
if [ "$1" = "--remove" ]; then echo "Removed scheduled scans."; exit 0; fi

write_plist $PREFIX.quick quick '<array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>10</integer></dict>
    <dict><key>Weekday</key><integer>4</integer><key>Hour</key><integer>7</integer><key>Minute</key><integer>10</integer></dict>
  </array>'
write_plist $PREFIX.full full '<dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>23</integer><key>Minute</key><integer>10</integer></dict>'

for L in $PREFIX.quick $PREFIX.full; do
  plutil -lint "$AGENTS/$L.plist" >/dev/null && launchctl bootstrap "gui/$UID_" "$AGENTS/$L.plist" && echo "Installed $L"
done
echo "Logs: $ROOT/data/logs/   Test now: zsh $ROOT/my-scripts/run-scans.sh quick"
