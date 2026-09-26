#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 || [ ! -f .env ] || [ ! -f dist/index.html ] || [ ! -f node_modules/express/package.json ]; then
  echo 'Run Setup-Mac.command first. It installs dependencies and builds the application.'
  read -r -p 'Press Return to close.'
  exit 1
fi
echo 'Keep this window open while using Optical Operator.'
echo 'Open the browser address printed by the server below.'
node --env-file=.env apps/api/server.mjs
optical_exit=$?
echo 'Optical Operator has stopped.'
read -r -p 'Press Return to close.'
exit "$optical_exit"
