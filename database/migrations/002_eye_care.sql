-- Additive foundation only: medical encounters do not imply an optical examination.
CREATE TABLE IF NOT EXISTS encounters (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES practices(id),
 patient_id TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 provider TEXT,
 location TEXT,
 encounter_type TEXT NOT NULL,
 source_system TEXT NOT NULL CHECK(length(trim(source_system)) > 0),
 source_id TEXT NOT NULL CHECK(length(trim(source_id)) > 0),
 import_id TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,source_system,source_id),
 FOREIGN KEY(tenant_id,patient_id) REFERENCES patients(tenant_id,id),
 FOREIGN KEY(tenant_id,import_id) REFERENCES imports(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS clinical_records (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES practices(id),
 encounter_id TEXT NOT NULL,
 record_type TEXT NOT NULL,
 metadata TEXT NOT NULL DEFAULT '{}' CHECK(CASE WHEN json_valid(metadata) THEN json_type(metadata) = 'object' ELSE 0 END),
 source_system TEXT NOT NULL CHECK(length(trim(source_system)) > 0),
 source_id TEXT NOT NULL CHECK(length(trim(source_id)) > 0),
 import_id TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,source_system,source_id),
 FOREIGN KEY(tenant_id,encounter_id) REFERENCES encounters(tenant_id,id),
 FOREIGN KEY(tenant_id,import_id) REFERENCES imports(tenant_id,id)
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(tenant_id,patient_id,occurred_at);
CREATE INDEX IF NOT EXISTS idx_clinical_records_encounter ON clinical_records(tenant_id,encounter_id);
