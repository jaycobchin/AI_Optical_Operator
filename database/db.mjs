import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
export const id = (prefix = 'id') => `${prefix}_${randomUUID()}`;
export const timestamp = () => new Date().toISOString();
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function passwordMatches(password, encoded) { const [salt, hash] = encoded.split(':'); return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex')); }
export function openDatabase(path = process.env.DATABASE_PATH || './data/operator.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path); db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  try {
    // The initial migration is idempotent, so existing v0.1 databases can be adopted.
    // Run the upgrade atomically and remember each applied migration.
    transaction(db, () => {
      db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
      const directory = new URL('./migrations/', import.meta.url);
      for (const name of readdirSync(directory).filter(name => /^\d+_.*\.sql$/.test(name)).sort()) {
        if (db.prepare('SELECT name FROM schema_migrations WHERE name = ?').get(name)) continue;
        db.exec(readFileSync(new URL(name, directory), 'utf8'));
        db.prepare('INSERT INTO schema_migrations(name,applied_at) VALUES(?,?)').run(name, timestamp());
      }
    });
  } catch (error) { db.close(); throw error; }
  if (path !== ':memory:') chmodSync(path, 0o600);
  return db;
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; } catch (err) { db.exec('ROLLBACK'); throw err; }
}
const TABLES = new Set(['outlets','families','patients','visits','encounters','clinical_records','prescriptions','contact_lens_rx','appointments','products','transactions','transaction_lines','orders','opportunities','campaigns','communications','events','imports','mappings','audit_events','users']);
export function tenantStore(db, tenantId) {
  if (!tenantId || !db.prepare('SELECT id FROM practices WHERE id = ?').get(tenantId)) throw Error('Invalid practice context');
  const table = name => { if (!TABLES.has(name)) throw Error('Unknown entity'); return name; };
  return {
    tenantId, db,
    all: (name, where = '1=1', params = []) => db.prepare(`SELECT * FROM ${table(name)} WHERE tenant_id = ? AND (${where})`).all(tenantId, ...params),
    get: (name, recordId) => db.prepare(`SELECT * FROM ${table(name)} WHERE tenant_id = ? AND id = ?`).get(tenantId, recordId),
    insert(name, record) {
      const item = { ...record, tenant_id: tenantId };
      const keys = Object.keys(item);
      if (keys.some(key => !/^[a-z_]+$/.test(key))) throw Error('Invalid column');
      db.prepare(`INSERT INTO ${table(name)} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(key => item[key] ?? null));
      return item;
    },
    update(name, recordId, changes) {
      const keys = Object.keys(changes); if (!keys.length || keys.some(key => !/^[a-z_]+$/.test(key) || ['tenant_id','id'].includes(key))) throw Error('Invalid update');
      return db.prepare(`UPDATE ${table(name)} SET ${keys.map(key => `${key} = ?`).join(',')} WHERE tenant_id = ? AND id = ?`).run(...keys.map(key => changes[key] ?? null), tenantId, recordId);
    },
    audit(action, entityId, userId = null, details = {}) { this.insert('audit_events', { id: id('audit'), action, entity_id: entityId, user_id: userId, details: JSON.stringify(details), created_at: timestamp() }); },
    practice() { return db.prepare('SELECT * FROM practices WHERE id = ?').get(tenantId); },
  };
}
export function patientFacts(store) {
  // Every correlated query includes the authenticated practice as well as patient ID.
  return store.db.prepare(`SELECT p.*,
    (SELECT MAX(date) FROM visits v WHERE v.tenant_id=p.tenant_id AND v.patient_id=p.id) AS last_exam,
    (SELECT MAX(date) FROM transactions t WHERE t.tenant_id=p.tenant_id AND t.patient_id=p.id AND t.status='paid') AS last_purchase,
    (SELECT COALESCE(SUM(total),0) FROM transactions t WHERE t.tenant_id=p.tenant_id AND t.patient_id=p.id AND t.status='paid') AS lifetime_value,
    (SELECT total FROM transactions t WHERE t.tenant_id=p.tenant_id AND t.patient_id=p.id AND t.status='paid' ORDER BY date DESC,id DESC LIMIT 1) AS last_total,
    (SELECT MAX(date) FROM transactions t WHERE t.tenant_id=p.tenant_id AND t.patient_id=p.id AND t.category='Contact lenses' AND t.status='paid') AS last_cl_purchase,
    (SELECT MAX(date) FROM appointments a WHERE a.tenant_id=p.tenant_id AND a.patient_id=p.id AND a.status IN ('no-show','cancelled')) AS missed_date,
    (SELECT MAX(date) FROM appointments a WHERE a.tenant_id=p.tenant_id AND a.patient_id=p.id AND a.status IN ('scheduled','completed')) AS rebooked_date,
    (SELECT MIN(date) FROM orders o WHERE o.tenant_id=p.tenant_id AND o.patient_id=p.id AND o.status='ready') AS order_date,
    (SELECT 'ready' FROM orders o WHERE o.tenant_id=p.tenant_id AND o.patient_id=p.id AND o.status='ready' LIMIT 1) AS order_status
    FROM patients p WHERE p.tenant_id=?`).all(store.tenantId);
}
