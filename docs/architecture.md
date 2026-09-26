# v0.2 implementation notes

The application remains a modular monolith: React/Vite frontend, Express API, SQLite canonical store, deterministic rules and controlled language templates. This update implements the changes between the archived v0.1 specification and `AI_Optical_Operator_MVP_Specification_v0.2_UPDATED.md` without replacing the existing retail model.

## Eye-care foundation

`002_eye_care.sql` adds `encounters` with patient, occurrence time, provider, location and encounter type, and `clinical_records` with encounter, record type and structured JSON metadata. Both carry source system, source record ID, optional import reference and creation timestamp. The `(tenant_id, source_system, source_id)` uniqueness constraint permits different source systems to use the same external identifier. Composite foreign keys enforce same-practice patients, encounters and import references.

The schema retains minimal structured metadata rather than adding fields for full clinical notes. A future authorised ingestion adapter must define an explicit field allowlist for its documented purpose before storing clinical content. No medical-data endpoints or clinical mutation workflows are introduced. New entities are available through the existing tenant store for future adapters. General encounters do not populate `last_exam` or change optical recall calculations.

Database startup discovers numbered SQL migrations, applies pending migrations in a transaction, and records them in `schema_migrations`. The original idempotent migration can be registered on existing v0.1 databases without deleting their records. Tests create a v0.1 file, upgrade it, reopen it and verify the original records and foreign keys.

## Connectors

`connectors/base.mjs` defines the capability contract. `connectors/index.mjs` registers the existing Generic CSV/XLSX importer and a future Plato adapter. Capabilities default to false and reflect implemented operations:

| Connector | File import | Incremental import | Live read | Vendor write-back | Clinical write |
| --- | --- | --- | --- | --- | --- |
| Generic CSV/XLSX | Yes | Yes, by existing source ID | No | No | No |
| Plato Medical | No | No | No | No | No |

The generic adapter reuses existing inspection/mapping, validation and transactional import functions. API inspection stores the selected connector with the tenant/user-bound preview, and validation/commit use that same connector. Clients cannot select an unavailable capability or change the connector during commit. Import mappings and inspection audit events record connector identity.

Plato's stub has no endpoints, credentials, authentication assumptions or network requests. Implementation requires current official API documentation, scopes, commercial terms, and clinic/vendor authorisation. It must begin with documented read operations; enabling write-back would require separate supported mechanisms and explicit approval. The updated product roadmap is not permission to implement undocumented live integration.

## AI and communications

The existing language-provider boundary is preserved: a provider can choose a tone from an allowed set and receives only opportunity type and requested tone. Patient names are rendered locally. Clinical records, encounter data, contact details and free text do not enter the provider context. Regression tests verify this even when callers include clinical fields in the local context.

Campaign approval and mock delivery remain separate operations. Consent, contact availability and cooldown checks continue to run in the existing campaign domain. Integration tests cover both practice isolation and role checks along the import → opportunity → draft → approval → mock delivery flow.

## Frontend restoration

The workspace supplied for this update contained reusable components and API helpers but no `src/main.tsx` or stylesheet; the original production build failed. The new frontend reuses those components and provides a small working interface for the main action loop. It shows connector availability without presenting the Plato stub as a working integration. Settings, audit, assistant and bulk campaign APIs remain available for later UI expansion.
