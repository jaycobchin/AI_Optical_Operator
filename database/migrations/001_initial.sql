CREATE TABLE IF NOT EXISTS practices (id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Singapore', settings TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','manager','staff')), created_at TEXT NOT NULL, UNIQUE(tenant_id,id));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outlets (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), name TEXT NOT NULL, UNIQUE(tenant_id,id));
CREATE TABLE IF NOT EXISTS families (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), name TEXT NOT NULL, UNIQUE(tenant_id,id));
CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), filename TEXT NOT NULL, status TEXT NOT NULL, record_count INTEGER NOT NULL DEFAULT 0, report TEXT NOT NULL DEFAULT '{}', mapping TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, committed_at TEXT, UNIQUE(tenant_id,id));
CREATE TABLE IF NOT EXISTS mappings (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), name TEXT NOT NULL, columns_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS patients (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), source_id TEXT NOT NULL, name TEXT NOT NULL, dob TEXT, phone TEXT, email TEXT,
 marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK(marketing_consent IN (0,1)), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','deceased')),
 outlet TEXT NOT NULL DEFAULT 'Main practice', family_id TEXT, cl_interval INTEGER, import_id TEXT, created_at TEXT NOT NULL,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,source_id), FOREIGN KEY(tenant_id,family_id) REFERENCES families(tenant_id,id), FOREIGN KEY(tenant_id,import_id) REFERENCES imports(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, patient_id TEXT NOT NULL, date TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'eye examination', source_id TEXT NOT NULL, UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id));
CREATE TABLE IF NOT EXISTS prescriptions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, patient_id TEXT NOT NULL, date TEXT NOT NULL, modality TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id));
CREATE TABLE IF NOT EXISTS contact_lens_rx (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, patient_id TEXT NOT NULL, date TEXT NOT NULL, replacement_interval INTEGER, product TEXT, FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id));
CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, patient_id TEXT NOT NULL, date TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'follow-up', status TEXT NOT NULL CHECK(status IN ('scheduled','completed','no-show','cancelled')), source_id TEXT NOT NULL, UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id));
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), sku TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, UNIQUE(tenant_id,id), UNIQUE(tenant_id,sku));
CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, patient_id TEXT NOT NULL, date TEXT NOT NULL, total INTEGER NOT NULL CHECK(total >= 0), category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','refunded','void')), source_id TEXT NOT NULL, UNIQUE(tenant_id,id), UNIQUE(tenant_id,source_id), FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id));
CREATE TABLE IF NOT EXISTS transaction_lines (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, transaction_id TEXT NOT NULL, product_id TEXT, category TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL, FOREIGN KEY(tenant_id,transaction_id) REFERENCES transactions(tenant_id,id), FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id));
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, patient_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('ready','collected','cancelled')), source_id TEXT NOT NULL, UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id));
CREATE TABLE IF NOT EXISTS opportunities (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, patient_id TEXT NOT NULL, type TEXT NOT NULL, score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
 confidence REAL NOT NULL, estimated_value INTEGER NOT NULL DEFAULT 0, components TEXT NOT NULL, evidence TEXT NOT NULL, recommended_action TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','snoozed','queued','completed','dismissed','resolved')), snoozed_until TEXT,
 rule_version TEXT NOT NULL, calculated_at TEXT NOT NULL, UNIQUE(tenant_id,id), UNIQUE(tenant_id,patient_id,type), FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS campaigns (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), name TEXT NOT NULL, type TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('whatsapp','sms','email')),
 template TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','approved','completed')), created_at TEXT NOT NULL, approved_at TEXT, approved_by TEXT,
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,approved_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS communications (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL, patient_id TEXT NOT NULL, opportunity_id TEXT,
 channel TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','delivered','excluded','failed')),
 provider_id TEXT, sent_at TEXT, exclusion_reason TEXT, UNIQUE(tenant_id,id), UNIQUE(tenant_id,campaign_id,patient_id),
 FOREIGN KEY(tenant_id,campaign_id) REFERENCES campaigns(tenant_id,id), FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id), FOREIGN KEY(tenant_id,opportunity_id) REFERENCES opportunities(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, communication_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('delivered','reply','appointment','purchase')),
 transaction_id TEXT, created_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}',
 UNIQUE(tenant_id,communication_id,type), UNIQUE(tenant_id,transaction_id), FOREIGN KEY(tenant_id,communication_id) REFERENCES communications(tenant_id,id), FOREIGN KEY(tenant_id,transaction_id) REFERENCES transactions(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES practices(id), user_id TEXT, action TEXT NOT NULL, entity_id TEXT, details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id));
CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_patient ON transactions(tenant_id,patient_id,date);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(tenant_id,patient_id,date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(tenant_id,patient_id,date);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant ON opportunities(tenant_id,status,score DESC);
CREATE INDEX IF NOT EXISTS idx_communications_campaign ON communications(tenant_id,campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id,communication_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id,created_at DESC);
