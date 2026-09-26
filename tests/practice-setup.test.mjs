import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { configurePractice, requireSupportedNode } from '../scripts/practice-setup.mjs';

test('practice setup creates local non-demo settings and preserves them on repeat runs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'optical-setup-'));
  try {
    assert.equal(configurePractice(directory), true);
    const environment = parseEnv(readFileSync(join(directory, '.env'), 'utf8'));
    assert.equal(environment.HOST, '127.0.0.1');
    assert.equal(environment.SEED_DEMO, 'false');
    assert.equal(environment.DATABASE_PATH, './data/practice.sqlite');
    assert.equal(environment.ALLOW_SIGNUP, 'true');
    const custom = '# Practice configuration\nPORT=4321\nALLOW_SIGNUP=false\nDATABASE_PATH=./existing.sqlite\n';
    writeFileSync(join(directory, '.env'), custom);
    writeFileSync(join(directory, 'existing.sqlite'), 'existing data must survive');
    assert.equal(configurePractice(directory), false);
    assert.equal(readFileSync(join(directory, '.env'), 'utf8'), custom);
    assert.equal(readFileSync(join(directory, 'existing.sqlite'), 'utf8'), 'existing data must survive');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('practice setup rejects unsupported Node versions with actionable instructions', () => {
  assert.throws(() => requireSupportedNode('22.0.0'), /Install Node.js 24/);
  assert.doesNotThrow(() => requireSupportedNode('24.0.0'));
});
