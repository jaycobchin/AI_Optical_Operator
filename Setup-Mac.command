#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 24 LTS from https://nodejs.org/en/download, then reopen this file.'
  read -r -p 'Press Return to close.'
  exit 1
fi
node scripts/practice-setup.mjs && npm ci && npm run build
optical_exit=$?
if [ "$optical_exit" -eq 0 ]; then
  echo 'Setup complete. Open Start-Mac.command to run Optical Operator.'
  echo 'Instructions: docs/practice-computer-setup.md'
else
  echo 'Setup did not finish. Review the error above before trying again.'
fi
read -r -p 'Press Return to close.'
exit "$optical_exit"
