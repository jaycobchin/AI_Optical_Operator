import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const configuration = `PORT=3001
HOST=127.0.0.1
DATABASE_PATH=./data/practice.sqlite
SEED_DEMO=false
ALLOW_SIGNUP=true
APP_ORIGIN=http://127.0.0.1:3001
COOKIE_SECURE=false
AI_PROVIDER=template
`;

export function requireSupportedNode(version = process.versions.node) {
  if (Number(version.split('.')[0]) < 24) throw Error('Install Node.js 24 LTS or newer from https://nodejs.org/en/download, then run setup again.');
}

export function configurePractice(directory) {
  requireSupportedNode();
  try {
    // Re-running setup must never replace an existing practice configuration.
    writeFileSync(resolve(directory, '.env'), configuration, { flag: 'wx', mode: 0o600 });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const created = configurePractice(fileURLToPath(new URL('../', import.meta.url)));
    console.log(created ? 'Created a local practice configuration. Demo seeding is disabled.' : 'Existing .env preserved. Your practice settings have not been replaced.');
    console.log('After creating the first practice account, set ALLOW_SIGNUP=false in .env and restart.');
  } catch (error) {
    console.error(`Setup could not continue: ${error.message}`);
    process.exitCode = 1;
  }
}
