import test from 'node:test';
import assert from 'node:assert/strict';
import { getConnector, listConnectors } from '../connectors/index.mjs';
import { PlatoConnector } from '../connectors/plato/index.mjs';
import { openDatabase, tenantStore } from '../database/db.mjs';

test('generic connector retains approved CSV import and only advertises implemented capabilities', async () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO practices(id,name,created_at) VALUES(?,?,?)').run('a', 'A', '2026-09-26');
    const store = tenantStore(db, 'a'), connector = getConnector('generic-csv');
    const file = await connector.inspect(Buffer.from('Patient ID,Full Name\np1,Alex Tan'), 'patients.csv', 'patients');
    assert.equal(connector.validate(store, file.rows, file.mapping, file.entity).valid, 1);
    const result = connector.import(store, file, null);
    assert.equal(result.imported, 1);
    assert.equal(JSON.parse(store.get('imports', result.id).mapping).connector, 'generic-csv');
    assert.equal(connector.descriptor.capabilities.fileImport, true);
    assert.equal(connector.descriptor.capabilities.liveRead, false);
    assert.throws(() => connector.requireCapability('fileImport', 'clinical_records'), /support/i);
    assert.throws(() => connector.requireCapability('writeBack'), /support/i);
    assert.throws(() => getConnector('unregistered'), /Unknown connector/);
  } finally { db.close(); }
});

test('Plato is an unavailable stub: no invented capabilities, network reads or write-back', () => {
  const connector = new PlatoConnector();
  assert.equal(connector.descriptor.status, 'unavailable');
  assert.ok(Object.values(connector.descriptor.capabilities).every(value => value === false));
  assert.deepEqual(connector.descriptor.entities, []);
  assert.throws(() => connector.read(), /documentation.*authorisation/i);
  assert.throws(() => connector.requireCapability('fileImport', 'patients'), /unavailable/i);
  assert.throws(() => connector.requireCapability('writeBack'), /unavailable/i);
  assert.deepEqual(listConnectors().map(c => c.id), ['generic-csv', 'plato']);
});
