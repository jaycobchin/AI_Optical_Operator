# Changelog

This file records implemented changes and their verification. The first Git-tracked application version is 0.2.0; the earlier v0.1 specification and build brief remain in [archived/](archived/).

## Unreleased

### Documentation

- Added this changelog and linked it from the README.
- Recorded the v0.2 implementation, practice-computer setup, completed checks and remaining limitations.
- Added repository instructions in `AGENTS.md` requiring changelog maintenance alongside future meaningful changes, and clarified that no background changelog generator is installed.

## 0.2.0 — 2026-09-26

Initial repository snapshot: [`d2c4625`](https://github.com/jaycobchin/AI_Optical_Operator/commit/d2c4625), committed and pushed to `main`.

### Added

- Vendor-neutral `Encounter` and `ClinicalRecord` tables with tenant-scoped foreign keys, source-system provenance and structured clinical metadata.
- Transactional migration tracking that upgrades existing v0.1 databases while preserving retail records.
- A connector registry, capability checks and authenticated `GET /api/connectors`. CSV/XLSX inspection, validation and commit use the selected connector and record its identity.
- An unavailable `PlatoConnector` stub for future authorised API integration. It makes no network requests and advertises no unimplemented read or write capabilities.
- A working frontend with Overview, Opportunities, Campaigns and Data pages, reusing the existing components. Staff can review imports, edit drafts, approve outreach, simulate delivery and record outcomes.
- Windows and Mac setup/start launchers. Setup creates local non-demo settings, preserves an existing `.env`, checks the Node.js version, installs dependencies and builds the app.
- [Practice-computer setup instructions](docs/practice-computer-setup.md) and [architecture notes](docs/architecture.md).
- Tests for migration compatibility, clinical-record tenant isolation, connector restrictions, AI context minimisation, API approval boundaries, browser workflows and setup configuration preservation.

### Changed

- Updated application and API health versions to `0.2.0` to match the confirmed [v0.2 specification](AI_Optical_Operator_MVP_Specification_v0.2_UPDATED.md) and [build brief](AI_Optical_Operator_Codex_Build_Brief_v0.2_UPDATED.md).
- Preserved the existing optical opportunity rules, consent checks, human approval workflow and mock communications. General medical encounters do not count as optical examinations or enter language-provider context.
- Added connector availability to the Data page, with unsupported sources disabled.

### Fixed

- Restored the missing frontend entry point and stylesheet that prevented the original production build from completing.
- Aligned the frontend purchase type with the API's transaction category field.

### Verification completed

- `npm run check`: 16 unit/API tests and the TypeScript/Vite production build passed before the setup launchers were added.
- Two additional practice-setup tests passed after the launchers were added, covering preservation of settings/data and rejection of unsupported Node.js versions.
- One Playwright browser workflow passed: login, connector visibility, CSV import, opportunity draft, approval, mock delivery and mobile layout.
- A clean installation from the transfer ZIP passed on Mac, including a folder path containing spaces. The packaged launcher served the frontend and API with demo seeding disabled and initial practice registration enabled.
- Transfer ZIP integrity and exclusion of local databases, environment secrets and installed dependencies were checked.

### Known limitations

- Live POS synchronisation is not implemented. Plato requires current vendor documentation and authorised access; CSV/XLSX is the available ingestion method.
- Clinical entities are a foundation for future connectors. Clinical import, clinical UI and autonomous clinical actions are not provided.
- Patient communications use a mock provider; no external SMS, WhatsApp or email is sent.
- Windows launchers are included but have not been executed on Windows. The package targets a single-computer pilot, with manual startup.
- The frontend does not yet expose settings, audit browsing, assistant queries or bulk campaign creation, although their existing APIs remain available.
- Production backup/restore and deployment hardening remain unfinished. The `db:backup` command references a script that has not been implemented.
- The installation audit reported three unresolved moderate dependency findings involving `csv-parse`, `exceljs` and its `uuid` dependency. Dependency remediation remains separate work before production use.

## Maintaining this file

Add subsequent changes under **Unreleased**, distinguishing implemented work from planned work. When a version is released, move its entries into a dated version section. Record the checks actually completed and keep unresolved limitations explicit.

[AGENTS.md](AGENTS.md) instructs Codex to maintain this file as part of future changes. There is no Git hook, CI workflow or background process that generates entries automatically. Contributors making changes outside the Codex workflow must update this Markdown file themselves.
