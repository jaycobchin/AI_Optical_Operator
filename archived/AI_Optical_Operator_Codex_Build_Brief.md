# AI Optical Operator — Codex Build Brief

**Version:** 0.1  
**Purpose:** Concise implementation brief to place at the root of the coding project and give to Codex before development.

---

## Objective

Build a production-minded modular-monolith web application for optical practices.

The MVP is **not a POS replacement**. Existing optical systems remain the **system of record**. This application is the **system of action**.

Core loop:

**Data → Opportunity → Prioritisation → Recommended Action → Human Approval → Execution → Outcome Measurement**

The first release must prove that existing optical-practice data can be turned into measurable operational and revenue actions.

---

## MVP must include

1. Authentication and strict tenant isolation.
2. Canonical optical data model.
3. CSV/XLSX import wizard.
4. Source-column mapping with confidence and validation.
5. Duplicate-candidate detection.
6. Deterministic patient/revenue opportunity engine.
7. Opportunity dashboard and detail pages.
8. AI explanations and editable patient-message generation.
9. Human approval workflow.
10. Mock communication provider for development/testing.
11. Campaign tracking and analytics.
12. Audit log.
13. Synthetic demo dataset.
14. Automated tests.

---

## Initial opportunity types

- Overdue recall.
- Missed appointment.
- Contact-lens replenishment.
- Inactive valuable patient.
- Recent-purchase follow-up.
- Uncollected order, where source data exists.

Every opportunity must contain:

- patient reference
- opportunity type
- evidence
- source/provenance
- transparent score
- recommended action
- status
- human-approval requirement
- timestamp and rule version

---

## Architecture principles

- Use deterministic code and SQL for calculations and factual business metrics.
- Use the LLM for language, explanations and controlled analytical assistance.
- Never let the LLM invent patient facts, consent, prices, stock, appointments or clinical findings.
- Patient communications require human approval in the MVP.
- No autonomous clinical diagnosis, treatment, prescription changes or clinical-record modification.
- Strict tenant isolation must be enforced at application/database level, not only in prompts.
- Keep the LLM provider behind an abstraction so it can be changed later.
- Build Generic CSV/XLSX ingestion first; vendor connectors come later.
- Do not reverse-engineer private vendor databases or bypass access controls.
- Core deterministic features must continue working if the LLM provider is unavailable.
- Preserve auditability and source-data provenance for every important output.
- Minimise sensitive clinical data sent to the LLM.

---

## Core canonical entities

- Practice
- User
- Outlet
- Patient
- Family
- Appointment
- Examination/Visit
- Prescription
- ContactLensRx
- Transaction
- TransactionLine
- Product
- Communication
- Campaign
- Opportunity
- ImportRun
- Mapping
- AuditEvent

---

## Suggested modules

- `auth`
- `tenants`
- `users`
- `imports`
- `mapping`
- `patients`
- `appointments`
- `transactions`
- `products`
- `prescriptions`
- `opportunities`
- `campaigns`
- `communications`
- `analytics`
- `ai`
- `audit`
- `settings`

---

## Suggested repository

```text
/ai-optical-operator
  /apps
    /web
    /api
  /packages
    /domain
    /data-model
    /rules
    /ai
    /ui
  /database
    /migrations
    /seed
  /connectors
    /generic-csv
    /frontwave
    /optic-tech
    /practopal
  /jobs
  /tests
  /docs
  /scripts
  .env.example
  README.md
```

---

## Core workflows

### 1. Practice onboarding

1. Create tenant.
2. Create admin user.
3. Select source system or Generic CSV.
4. Upload files.
5. Detect schema.
6. Suggest mappings.
7. Review ambiguous fields.
8. Validate.
9. Detect duplicate candidates.
10. Preview import.
11. Approve.
12. Commit import.
13. Generate import report.
14. Run opportunity analysis.

### 2. Daily briefing

Display:

- overdue opportunities
- contact-lens replenishment opportunities
- inactive valuable patients
- missed appointments
- recommended first action for the day

### 3. Opportunity review

Show:

- patient
- opportunity type
- evidence
- score
- last relevant activity
- recommended action
- AI-generated draft
- confidence
- approve
- edit
- dismiss
- snooze

### 4. Campaign

1. Select segment.
2. Preview audience.
3. Apply exclusion/consent rules.
4. Generate message.
5. Edit.
6. Approve.
7. Queue/send through provider abstraction.
8. Record events.
9. Link bookings/purchases where possible.
10. Measure outcome.

### 5. Owner analytics question

For questions such as:

> Why did revenue fall last month?

The application must:

1. interpret the question,
2. run controlled database queries,
3. calculate facts deterministically,
4. give the LLM only the verified result set,
5. generate a concise explanation,
6. distinguish observation from causation.

---

## Build order

### Phase 0 — Foundation

- Repository.
- Frontend/backend/database.
- Environment configuration.
- Tenant/user model.
- Database migrations.
- Demo tenant and seed data.

### Phase 1 — Data ingestion

- CSV/XLSX upload.
- File inspection.
- Column mapping.
- Canonical model.
- Validation.
- Duplicate detection.
- Import preview.
- Transactional import/commit.
- Import audit log.

### Phase 2 — Opportunity engine

- Overdue-recall rule.
- Missed-appointment rule.
- CL-replenishment rule.
- Inactive-patient rule.
- Uncollected-order rule if data exists.
- Transparent scoring.
- Evidence/provenance.
- Status workflow.

### Phase 3 — Dashboard

- Daily briefing.
- Opportunity list.
- Filters.
- Opportunity detail.
- Approve/edit/dismiss/snooze workflow.

### Phase 4 — AI layer

- Provider abstraction.
- Structured context builder.
- Prompt templates.
- Message generation.
- Explanation generation.
- Controlled natural-language analytics.
- Output validation.
- Graceful fallback when AI is unavailable.

### Phase 5 — Campaigns

- Audience selection.
- Exclusion rules.
- Message editor.
- Approval.
- Mock sending.
- Provider abstraction.
- Event tracking.

### Phase 6 — Measurement

- Conversion linking.
- Revenue-attribution rules.
- Campaign analytics.
- Before/after comparisons.
- Exportable report.

### Phase 7 — Production hardening

- RBAC tests.
- Tenant-isolation tests.
- Security review.
- Audit review.
- Backup/restore.
- Monitoring.
- Rate limits.
- Data-retention controls.
- Privacy documentation.

---

## Critical acceptance tests

1. Practice A cannot retrieve Practice B data through UI, API, direct query path or AI interaction.
2. Known synthetic patients trigger exactly the expected opportunity rules.
3. A patient with a recent relevant visit is not incorrectly marked overdue.
4. A patient without required marketing permission is excluded from marketing campaigns.
5. Duplicate candidates are surfaced and are never silently merged.
6. AI cannot invent missing patient facts.
7. Revenue answers are calculated from controlled database queries rather than generated by the LLM.
8. No patient communication can be sent without the configured approval workflow.
9. Every opportunity contains evidence and provenance.
10. Failed imports do not partially corrupt canonical data.
11. The deterministic application remains usable if the AI provider fails.
12. Audit events are created for imports, approvals, campaign actions and key administrative changes.

---

## Synthetic demo data

Create at least:

- 1,000 patients
- 3,000 transactions
- appointments
- prescriptions
- contact-lens purchases
- campaign events

Include difficult cases:

- duplicate names
- shared family phone numbers
- missing DOBs
- invalid phone numbers
- no-consent patients
- multiple purchases on the same day
- cancelled/no-show appointments
- high-value historical customers
- incomplete records

---

## Product principle

Do **not** build the entire Optical AI Operator first.

First prove this loop:

**Import optical data → identify valuable patient opportunity → explain why → generate message → human approves → record action → measure booking/purchase/revenue.**

If that loop creates measurable value in a real optical practice, expand into:

- inventory intelligence
- operations agent
- business-intelligence agent
- automated live connectors
- multi-agent workflows
- governed benchmarking
- broader Optical Practice OS functionality

The full specification in `AI_Optical_Operator_MVP_Specification.md` remains the source of truth.
