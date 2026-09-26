import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, tenantStore, patientFacts } from '../database/db.mjs';

function seedPractices(db) {
  for (const tenant of ['a', 'b']) {
    db.prepare('INSERT INTO practices(id,name,created_at) VALUES(?,?,?)').run(tenant, tenant, '2026-09-26');
    tenantStore(db, tenant).insert('patients', { id: `patient-${tenant}`, source_id: 'P-1', name: `Patient ${tenant}`, created_at: '2026-09-26' });
  }
}
const encounter = (id, patient_id = 'patient-a') => ({ id, patient_id, occurred_at: '2026-09-01T02:00:00Z', encounter_type: 'consultation', provider: 'Synthetic provider', location: 'Main clinic', source_system: 'synthetic-emr', source_id: 'E-1', created_at: '2026-09-26' });
const clinicalRecord = (id, encounter_id = 'encounter-a') => ({ id, encounter_id, record_type: 'document-reference', metadata: JSON.stringify({ synthetic: true }), source_system: 'synthetic-emr', source_id: 'CR-1', created_at: '2026-09-26' });

test('v0.1 database upgrades in place and can reopen without losing retail or eye-care records', () => {
  const directory = mkdtempSync(join(tmpdir(), 'optical-migration-'));
  let db;
  try {
    const path = join(directory, 'operator.sqlite');
    db = new DatabaseSync(path);
    db.exec(readFileSync(new URL('../database/migrations/001_initial.sql', import.meta.url), 'utf8'));
    seedPractices(db);
    tenantStore(db, 'a').insert('visits', { id: 'old-visit', patient_id: 'patient-a', date: '2024-01-01', source_id: 'V-1' });
    db.close();
    db = openDatabase(path);
    const store = tenantStore(db, 'a');
    store.insert('encounters', encounter('encounter-a'));
    store.insert('clinical_records', clinicalRecord('record-a'));
    db.close();
    db = openDatabase(path);
    assert.equal(tenantStore(db, 'a').all('patients').length, 1);
    assert.equal(tenantStore(db, 'a').get('visits', 'old-visit').date, '2024-01-01');
    assert.equal(tenantStore(db, 'a').all('clinical_records').length, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 2);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('encounters and clinical records enforce tenant ownership on reads and foreign keys', () => {
  const db = openDatabase(':memory:');
  try {
    seedPractices(db);
    const a = tenantStore(db, 'a'), b = tenantStore(db, 'b');
    a.insert('encounters', encounter('encounter-a'));
    a.insert('clinical_records', clinicalRecord('record-a'));
    assert.equal(b.get('encounters', 'encounter-a'), undefined);
    assert.deepEqual(b.all('clinical_records'), []);
    assert.equal(b.update('clinical_records', 'record-a', { metadata: '{}' }).changes, 0);
    assert.throws(() => b.insert('encounters', encounter('bad-encounter')), /FOREIGN KEY/);
    assert.throws(() => b.insert('clinical_records', clinicalRecord('bad-record')), /FOREIGN KEY/);
    b.insert('encounters', encounter('encounter-b', 'patient-b'));
    b.insert('clinical_records', clinicalRecord('record-b', 'encounter-b'));
    assert.throws(() => a.update('clinical_records', 'record-a', { encounter_id: 'encounter-b' }), /FOREIGN KEY/);
    assert.throws(() => a.insert('encounters', encounter('duplicate-source')), /UNIQUE/);
    a.insert('encounters', { ...encounter('other-source'), source_system: 'another-emr' });
    assert.throws(() => a.update('clinical_records', 'record-a', { metadata: 'not-json' }), /CHECK/);
    assert.throws(() => a.update('clinical_records', 'record-a', { metadata: '[]' }), /CHECK/);
    // An arbitrary medical encounter must not be treated as a routine optical exam.
    assert.equal(patientFacts(a)[0].last_exam, null);
    assert.equal(Object.hasOwn(patientFacts(a)[0], 'metadata'), false);
  } finally { db.close(); }
});
