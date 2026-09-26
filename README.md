# Optical Operator

Optical-practice data import, deterministic opportunities, reviewed patient outreach, and campaign measurement. Updated against [the v0.2 specification](AI_Optical_Operator_MVP_Specification_v0.2_UPDATED.md) and [build brief](AI_Optical_Operator_Codex_Build_Brief_v0.2_UPDATED.md). Earlier requirements are retained under `archived/`.

## Run locally

Requires Node.js 24 or newer.

For a practice-computer pilot, use [the Windows/Mac setup guide](docs/practice-computer-setup.md). `Setup-Windows.cmd` and `Setup-Mac.command` install the app and create local non-demo settings without replacing an existing `.env`. The matching Start files launch the built app. The developer workflow below uses synthetic demo data.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Development mode seeds synthetic demo data by default. Sign in with `owner@demo.optical` and `OpticalDemo2026!`. The staff demo uses `staff@demo.optical` with the same password. Set `SEED_DEMO=false` to disable seeding. See `.env.example` for configuration; set `ALLOW_SIGNUP=true` if a non-demo environment needs practice registration.

The restored frontend provides Overview, Opportunities, Campaigns and Data. Import a CSV/XLSX, review its mappings and validation report, approve valid rows, review an opportunity, edit and approve its message, then simulate delivery in Campaigns. Record replies, appointments and eligible purchases there. Communications use a mock provider and do not send external messages.

```bash
npm run check
# Browser workflow using an installed Google Chrome:
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
# Alternatively install Playwright Chromium once, then use npm run test:e2e:
npx playwright install chromium
```

Browser tests use an isolated in-memory demo database and localhost port 3101. They never modify the development database. Unit/API tests cover imports, rules, AI safeguards, migration, connector restrictions, tenant ownership and approval. `npm run build` produces `dist/`; `npm start` serves the built frontend and API at http://127.0.0.1:3001.

## v0.2 changes

See [CHANGELOG.md](CHANGELOG.md) for the dated implementation history, verification results and known limitations.

[AGENTS.md](AGENTS.md) instructs Codex to update the changelog with future meaningful changes. This uses [Codex's repository instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md); it is not an automatic Git or background update. Contributors working outside that workflow should update `CHANGELOG.md` with their changes.

- Additive `Encounter` and `ClinicalRecord` tables with tenant-scoped relationships and source-system provenance. Existing retail tables and rules are preserved. Database startup applies numbered migrations transactionally, including adoption of databases created before migration tracking.
- A connector registry exposes implemented capabilities at authenticated `GET /api/connectors`. Import routes enforce the selected connector's capabilities. CSV/XLSX remains the available import source.
- `PlatoConnector` is an unavailable future API stub. It performs no network calls, claims no undocumented vendor capabilities, and cannot read or write vendor data.
- Clinical records are a foundation for future authorised connectors. This release does not expose clinical records in the UI, enable clinical CSV import, or treat a general medical encounter as an optical examination. Language providers receive only opportunity type and tone.
- The missing frontend entry point and styles have been added using the existing UI components.
- Windows and Mac setup/start launchers simplify practice-computer installation and preserve existing configuration. Mac installation and startup were verified; Windows execution remains untested.

This remains a local MVP, not a completed production deployment. The small frontend does not yet expose every existing API feature, such as settings, audit browsing, assistant queries or bulk campaign creation. See [architecture notes](docs/architecture.md) for the connector boundary and migration details.
