# AI Optical Operator — MVP Product & Engineering Specification

**Version:** 0.2  
**Date:** September 2026  
**Purpose:** Build-ready specification for Codex / Visual Studio Code

> **Core product:** Keep the optical practice's existing software as the system of record. Add an AI operator that turns practice data into actions: identify opportunities, recommend actions, generate communications, obtain human approval, execute permitted workflows, and measure outcomes.

---

# AI Optical Operator

Purpose: Build an AI intelligence-and-action layer for optical practices that connects to existing practice-management/POS data, identifies revenue and operational opportunities, recommends the next best actions, drafts patient communications, and measures outcomes — without replacing the clinic's existing system of record.

## 1. Product vision

Positioning: “Keep your existing optical software. Add an AI operator that turns your practice data into actions.”

The MVP is not another POS, electronic health-record replacement, inventory system, or generic chatbot. Existing systems remain the system of record. The AI Optical Operator becomes the system of action: it continuously analyses available practice data, surfaces opportunities, explains why they matter, proposes an action, obtains approval where required, executes permitted communication/workflows, and records the outcome.

Core loop: Data → Opportunity detection → Prioritisation → Recommended action → Human approval → Execution → Outcome measurement → Learning/next action.

#### System of record

Existing POS/practice software stores patients, prescriptions, transactions, products, appointments and stock.

#### System of action

AI Operator interprets those records and tells staff what to do next, then helps execute the work.

#### Business outcome

More appropriate patient reactivation, better retention, fewer missed opportunities, staff time savings and clearer business decisions.

## 2. MVP scope

The first MVP should deliberately solve one commercially valuable problem extremely well: finding patient/revenue opportunities and turning them into measurable outreach.

### MVP name

AI Revenue Operator for Optical Practices

### Must-have MVP capabilities

| Capability | What it does | Priority |
| --- | --- | --- |
| Data import | Accept CSV/XLSX exports from an optical practice. Store a normalised copy in the MVP database. | P0 |
| Universal optical data model | Map different source formats into common patient, visit, prescription, transaction, product and communication entities. | P0 |
| Data-quality scan | Detect duplicates, missing contact details, invalid dates, unmapped fields and suspicious records. | P0 |
| Patient opportunity engine | Identify overdue/re-engagement/contact-lens/appointment opportunities using deterministic rules first. | P0 |
| Opportunity scoring | Rank opportunities by urgency, relevance, estimated value, likelihood of response and confidence. | P0 |
| AI explanation | Explain why a patient is on the list using source data; never invent facts. | P0 |
| Message generator | Generate editable WhatsApp/SMS/email drafts appropriate to the selected campaign. | P0 |
| Human approval | Staff review/edit/approve messages before sending. | P0 |
| Campaign tracking | Record campaign, recipient, message, status and response/conversion events where available. | P0 |
| ROI dashboard | Show contacts, responses, appointments, purchases and revenue attributable to campaigns when data permits. | P0 |
| Daily opportunity briefing | Dashboard summarises the highest-value actions for today. | P0 |

### Explicitly out of scope for v0.1

- Replacing POS functionality.
- Autonomous clinical diagnosis, treatment recommendations or prescription changes.
- Autonomous patient messaging without configured consent/approval controls.
- Automatic changes to the source POS database.
- Full inventory purchasing automation.
- Full appointment scheduling automation.
- Training a foundation AI model from scratch.
- Cross-clinic identifiable patient-data pooling.
- NEHR integration unless separately specified, assessed and authorised.

Principle: Build the smallest product that can demonstrate measurable business value from real optical data. Do not build a full “optical OS” before proving the revenue/action layer.

## 3. Users and jobs-to-be-done

| User | Primary job | MVP experience |
| --- | --- | --- |
| Practice owner | Know where revenue/opportunities are being lost and what to do. | Executive dashboard, opportunity list, campaign results. |
| Optical manager | Turn opportunities into daily staff actions. | Queues, filters, approvals, campaign management. |
| Optometrist | Maintain clinical control and avoid inappropriate automation. | Clinical information shown as context; no autonomous clinical decision. |
| Front-desk staff | Contact patients efficiently and record outcomes. | Approved message queue and follow-up tasks. |

### Primary MVP persona

A Singapore optical practice with an existing POS/practice-management system and at least several thousand historical patient records. The practice wants additional value from its existing data without replacing its current software.

## 4. Universal eye-care data model

The system must not be designed around one vendor's database or assume every source is a retail POS. Create a canonical internal **eye-care data model** and write adapters that map source data into it. FrontWave, PractoPal and Optic Tech may populate retail-heavy entities, while Plato Medical and future EMRs may populate encounter and clinical-record entities.

**Architectural principle: eye-care ready, optical first.** The first commercial MVP remains focused on optical-practice revenue workflows, but the foundation must support medical eye-clinic data without a later database redesign.

### Core entities

| Entity | Minimum fields | Why needed |
| --- | --- | --- |
| Practice | practice_id, name, timezone, outlets, settings | Tenant isolation and configuration. |
| Patient | patient_id, source_id, name, DOB/age where permitted, phone, email, consent flags, status, created_at | Identity and communication. |
| Family | family_id, patient relationships | Useful later for family-level opportunities. |
| Appointment | appointment_id, patient_id, date/time, type, status, outlet, staff | Missed/overdue appointment opportunities. |
| Encounter | encounter_id, patient_id, date/time, provider, location, encounter_type, source_id | Vendor-neutral consultation/clinical encounter. |
| ClinicalRecord | clinical_record_id, encounter_id, record_type, structured metadata, source_id | Future medical eye-clinic support; minimise content and unnecessary LLM exposure. |
| Examination/Visit | visit_id, patient_id, date, visit type, provider, selected clinical metadata | Recency and patient lifecycle. Keep clinical fields minimised in MVP. |
| Prescription | rx_id, patient_id, date, modality, OD/OS fields where authorised | Context and segmentation; not for autonomous clinical decisions. |
| ContactLensRx | brand/product, modality, parameters, date, replacement interval where available | Replenishment opportunity detection. |
| Transaction | transaction_id, patient_id, date, outlet, staff, subtotal, discount, total, status | Revenue and recency analysis. |
| TransactionLine | SKU, category, quantity, unit price, discount, cost if available | Product/category behaviour. |
| Product | SKU, brand, category, model, supplier, cost, selling price | Future inventory intelligence. |
| Communication | patient_id, campaign_id, channel, sent_at, status, response/outcome | Closed-loop measurement. |
| Campaign | campaign_id, objective, segment, message template, dates, owner, status | Campaign management. |
| Opportunity | patient_id, type, score, reasons, evidence, recommended_action, status | Core AI Operator object. |

### Data minimisation

Only ingest fields needed for the MVP. Sensitive clinical data should not be sent to an LLM when the task can be completed using non-clinical/derived fields. The system should retain provenance showing which source record produced each important insight.

### Example opportunity object

```text
{
  "opportunity_id": "opp_123",
  "patient_id": "p_456",
  "type": "OVERDUE_RECALL",
  "priority": "HIGH",
  "score": 87,
  "evidence": [
    {"field":"last_exam_date","value":"2024-02-15"},
    {"field":"days_since_exam","value":589},
    {"field":"last_transaction_total","value":420}
  ],
  "recommended_action":"Invite patient for routine eye examination",
  "confidence":0.94,
  "requires_human_approval":true
}
```

## 5. AI Operator engine

The MVP should use a hybrid architecture: deterministic rules and calculations decide whether an opportunity exists; the LLM explains, drafts and assists with language. Do not let the LLM independently calculate critical business facts when SQL/code can calculate them reliably.

### Layer A — Data/analytics engine

- SQL queries and application logic calculate recency, frequency, monetary value, intervals, counts and campaign outcomes.
- Rules identify candidate opportunities.
- All numerical values displayed to users must be traceable to stored data.

### Layer B — Opportunity engine

Initial rule families:

| Opportunity | Example trigger | Recommended action |
| --- | --- | --- |
| Overdue recall | Last relevant exam/visit exceeds configurable interval. | Invite for routine follow-up; never imply a diagnosis. |
| Missed appointment | Appointment status = no-show/cancelled without rebooking. | Offer convenient rebooking. |
| Contact-lens replenishment | Prior CL purchase + estimated replacement interval reached + no recent replenishment. | Invite patient to replenish/check stock or arrange appointment according to practice policy. |
| Inactive valuable patient | Previously active/high-value patient with unusually long inactivity. | Re-engagement message. |
| Recent purchase follow-up | Recent transaction with configured follow-up window. | Service/satisfaction follow-up. |
| Uncollected order | Order exists and remains uncollected beyond configurable threshold. | Collection reminder. |

### Opportunity scoring

Use a transparent score, not a black-box model, for v0.1. Example:

```text
score =
  urgency_weight * urgency +
  recency_gap_weight * recency_gap +
  historical_value_weight * normalized_historical_value +
  actionability_weight * actionability +
  response_history_weight * response_likelihood
```

Store every component and expose a simple “Why this is prioritised” explanation. Thresholds must be configurable per practice.

### Layer C — LLM assistant

The LLM receives only the minimum context required for the task. It can:

- Explain an opportunity in plain language.
- Draft patient-friendly messages.
- Rewrite messages to be shorter, warmer or more professional.
- Summarise campaign results.
- Answer owner questions about the practice using retrieved, structured data.
- Suggest additional segments or questions for future analysis.

LLM guardrail: The model must never fabricate patient history, purchase history, consent, appointment availability, clinical findings, prices or stock. If the required fact is absent, it must say that the information is unavailable.

## 6. Core MVP workflows

### Workflow A — Onboard a practice

1. Create practice tenant.
2. Create admin user.
3. Select source system or “Generic CSV”.
4. Upload exported CSV/XLSX files.
5. System profiles the files and shows detected columns.
6. Map source columns to canonical fields.
7. Show confidence and unmapped fields.
8. Run duplicate/data-quality checks.
9. Show import preview.
10. User approves.
11. Import into tenant database.
12. Run initial opportunity analysis.

### Workflow B — Daily AI briefing

Dashboard should open with:

```text
GOOD MORNING — YOUR PRACTICE

47 overdue follow-up opportunities
18 contact-lens replenishment opportunities
12 inactive high-value patients
8 missed appointments requiring follow-up

AI recommendation:
Start with the 18 contact-lens opportunities.
Reason: strong actionability + recent historical purchase pattern.

[Review opportunities]
```

### Workflow C — Review an opportunity

Show:

- Patient identifier/name according to role permissions.
- Opportunity type.
- Priority.
- Evidence used.
- Last relevant transaction/visit dates.
- Recommended action.
- Suggested message.
- Confidence.
- “Approve & queue” / “Edit” / “Dismiss” / “Snooze”.

### Workflow D — Campaign

1. User chooses an opportunity segment.
2. System shows estimated audience and exclusion reasons.
3. AI drafts message.
4. User edits/approves.
5. System queues communication through a configured provider.
6. Each event is logged.
7. Conversions are linked back where possible.
8. Dashboard reports outcomes.

### Workflow E — Owner asks a business question

Example: “Why did sales fall last month?”

System should translate the question into safe analytical operations, retrieve structured data, calculate comparisons, and produce a concise explanation with evidence. Example answer format:

```text
Revenue decreased 8.4% compared with the previous month.

Main observed changes:
• 13% fewer transactions
• average transaction value increased 5%
• contact-lens revenue decreased 21%
• Branch B accounted for most of the transaction decline

Possible operational actions:
1. Review overdue CL replenishment opportunities.
2. Review Branch B appointment/no-show pattern.
3. Check stock availability for top CL SKUs.

These are observations from the available data, not proof of causation.
```

### Workflow F — Data refresh

Design the MVP so a new CSV upload can be treated as an incremental refresh rather than only a one-time migration. Later connectors can replace this mechanism without redesigning the analytics layer.

## 7. User interface

Build a clean web dashboard first. The UI should feel like a business operations product, not a chatbot.

### Screen 1 — Login

- Email/password or development-only auth.
- Practice/tenant context.
- Role-aware navigation.

### Screen 2 — Dashboard

#### Opportunities

Count by type and priority.

#### Potential revenue

Clearly labelled as an estimate, not guaranteed revenue.

#### Campaigns

Active campaigns and outcomes.

#### Data health

Import quality, missing fields, last refresh.

### Screen 3 — Opportunities

Filters: opportunity type, priority, outlet, date range, patient segment, status. Table columns: patient, opportunity, evidence summary, score, last activity, recommended action, status.

### Screen 4 — Opportunity detail

Evidence timeline + explanation + draft communication + action buttons.

### Screen 5 — Campaigns

Campaign creation, audience preview, exclusions, message editor, approval, send/queue, results.

### Screen 6 — Campaign analytics

Recipients → delivered → replies → appointments → purchases → revenue. Show conversion rates only where denominator/data is valid.

### Screen 7 — Data

Source files, import runs, mappings, data-quality warnings, last sync, record counts and failed rows.

### Screen 8 — Settings

Practice settings, opportunity thresholds, communication rules, consent rules, user roles, outlets, campaign defaults and AI configuration.

### Screen 9 — AI Assistant

A controlled natural-language interface for questions such as “Show me patients overdue by more than 18 months” or “How did contact lens sales change last month?” It must ground responses in structured tenant data.

## 8. Technical architecture for Codex/VS Code

Use a modular monolith for the MVP. Do not start with microservices.

### Recommended logical stack

| Layer | MVP responsibility |
| --- | --- |
| Frontend | Responsive web application; dashboard, tables, forms, campaign approval. |
| Backend/API | Authentication, tenant isolation, imports, opportunities, campaigns, analytics, audit events. |
| Database | Relational database such as PostgreSQL for canonical entities and analytics. |
| Object storage | Temporary/raw import files and controlled exports; encrypt and apply retention rules. |
| Background jobs | Imports, deduplication, opportunity generation, campaign processing. |
| LLM layer | Message drafting, explanations and natural-language analytics assistance. Keep provider abstraction. |
| Rules engine | Deterministic opportunity rules and scoring. |
| Audit layer | Track imports, user approvals, AI outputs, actions, sends and configuration changes. |

### Suggested repository structure

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
    /plato
  /jobs
  /tests
  /docs
  /scripts
  .env.example
  README.md
```

The exact programming language/framework can be selected based on the developer's strongest stack. The architecture matters more than choosing a particular framework.

### Key backend modules

- auth
- tenants
- users
- imports
- mapping
- patients
- appointments
- transactions
- products
- prescriptions
- opportunities
- campaigns
- communications
- analytics
- ai
- audit
- settings

## 9. Security, privacy and governance

This is a health-data product. Treat privacy/security as architecture requirements, not a later feature.

The MVP should be designed around Singapore data-protection requirements and the practice's contractual/regulatory obligations. PDPC guidance specifically highlights protection obligations for service providers handling client personal data in AI systems and recommends practices such as data mapping, labelling and provenance records.

Singapore's Health Information Act framework was enacted in February 2026 and includes requirements around health information contribution, access and protection. The current official resources also identify cybersecurity/data-security expectations for healthcare providers and relevant health-information systems.

### Mandatory MVP security requirements

- Strict tenant isolation: Clinic A can never query Clinic B data.
- Role-based access control.
- Encryption in transit and at rest.
- Secure secrets management; never hard-code API keys.
- Audit logging for logins, imports, data views where appropriate, approvals, sends and administrative changes.
- Import-file access controls and retention policy.
- Data minimisation.
- LLM prompt/data logging policy; avoid retaining sensitive prompts unnecessarily.
- No cross-tenant LLM training using identifiable patient data.
- Human approval for patient communications in MVP.
- No autonomous clinical decisions.
- Backups and tested restore process.
- Rate limiting and abuse protection.
- Validation and sanitisation of uploaded files.

### Data provenance

Every generated opportunity should be traceable to source data and calculation logic. Store source record IDs, calculation timestamp, rule version and relevant evidence. This makes the system explainable and auditable.

### Data migration

Singapore's Code of Practice for Data Portability describes accurate and complete porting of records as important for continuity of care and sets expectations around data migration practices. The product should therefore treat import/migration as a controlled process with mapping, validation, acceptance criteria and reconciliation rather than “upload a spreadsheet and hope.”

### Important regulatory boundary

Do not claim the MVP is “PDPA compliant”, “HIA compliant”, “NEHR compliant” or medically certified merely because technical safeguards exist. Compliance depends on the deployment, contracts, purposes, data flows, applicable requirements and professional/legal assessment.

## 10. Integration strategy

Start with Generic CSV/XLSX import. This allows the product to be tested with real practice data before negotiating or building vendor-specific integrations.

### Plato Medical integration

Plato Medical should be treated as a first-class **future live connector**, not merely as a CSV migration target. Plato publicly describes a Developer Platform/API for integrating external software with clinic workflows. Before implementation, obtain the current official API documentation, authentication requirements, scopes, commercial terms and clinic/vendor authorisation.

```text
Plato Medical
      │ authorised API
      ▼
PlatoConnector
      │
      ▼
Universal Eye-Care Data Model
      │
      ▼
AI Operator Engine
```

Start **read-first**. Do not invent undocumented Plato API endpoints. Future write-back must use documented vendor-supported mechanisms, explicit permissions, audit logging and appropriate human approval. Each connector should expose capability flags so workflows only use functions the source actually supports.

### Connector abstraction

```text
interface OpticalConnector {
  detect(source): SourceProfile
  inspect(source): SourceSchema
  map(source, canonicalSchema): MappingResult
  validate(mappedData): ValidationReport
  import(mappedData): ImportResult
}
```

Future adapters can include:

- FrontWaveConnector
- OpticTechConnector
- PractoPalConnector
- GenericCSVConnector

Do not reverse-engineer a vendor's private database or bypass access controls. Use authorised exports, APIs or vendor-supported mechanisms. The public availability of a particular vendor API/export should be verified before implementation.

### Import wizard

1. Upload/select source.
2. Detect file type and columns.
3. Display mapping suggestions.
4. Show confidence for each mapping.
5. Flag ambiguous fields.
6. Run validation.
7. Show duplicate candidates.
8. Preview affected record counts.
9. Require approval.
10. Import.
11. Generate import report.

### Migration report

Example:

```text
Import completed

Patients detected:       12,438
Imported:                12,201
Duplicate candidates:       143
Invalid records:             58
Unmapped rows:               36

Data quality:
Contactable patients:     10,842
Patients with purchases:   9,117
Patients with visits:     11,002

[Review exceptions]
```

## 11. Build sequence for Codex

Build in vertical slices so every stage produces a working application.

### Phase 0 — Foundation

- Create repository and development instructions.
- Set up frontend/backend/database.
- Create environment configuration.
- Create tenant/user model.
- Create database migrations.
- Create seed/demo practice.

### Phase 1 — Data ingestion

- CSV/XLSX upload.
- File inspection.
- Column mapping UI.
- Canonical data model.
- Validation.
- Deduplication candidate detection.
- Import preview and commit.
- Import audit log.

### Phase 2 — Opportunity engine

- Implement overdue recall rule.
- Implement missed appointment rule.
- Implement CL replenishment rule.
- Implement inactive patient rule.
- Implement uncollected order rule if order data exists.
- Implement transparent scoring.
- Generate opportunity explanations.

### Phase 3 — Dashboard

- Daily briefing.
- Opportunity table.
- Opportunity detail.
- Filters.
- Status workflow: new → approved/queued → completed/dismissed.

### Phase 4 — AI layer

- LLM provider abstraction.
- Structured context builder.
- Prompt templates.
- Message generation.
- Explanation generation.
- Natural-language analytics with tool/function calls to controlled queries.
- Output validation.

### Phase 5 — Campaigns

- Campaign creation.
- Audience preview.
- Exclusion rules.
- Message editor.
- Approval workflow.
- Provider abstraction for SMS/WhatsApp/email.
- Mock sending provider for development.
- Event tracking.

### Phase 6 — Measurement

- Conversion linking.
- Revenue attribution rules.
- Campaign dashboard.
- Before/after comparisons.
- Exportable report.

### Phase 7 — Production hardening

- RBAC testing.
- Tenant-isolation tests.
- Security review.
- Audit review.
- Backup/restore.
- Error monitoring.
- Rate limits.
- Data-retention controls.
- Privacy/contract documentation.

## 12. MVP acceptance criteria

| Area | Acceptance test |
| --- | --- |
| Tenant isolation | Create two practices; queries, dashboards and AI responses for Practice A must never expose Practice B records. |
| Import | A sample CSV can be mapped, validated, previewed and imported without manual database edits. |
| Data quality | Duplicate and invalid records are surfaced before final import. |
| Opportunity detection | Known synthetic test patients trigger the expected opportunity rules. |
| Explainability | Every opportunity displays evidence and rule/calculation provenance. |
| AI accuracy | AI message drafts contain only supplied facts and never invent patient details. |
| Approval | No patient communication is sent by the MVP without the configured approval path. |
| Analytics | Campaign results reconcile against stored events and transactions. |
| Auditability | Imports, approvals and campaign actions have timestamped audit events. |
| Clinical safety | The system cannot independently diagnose, prescribe, alter prescriptions or write clinical records. |
| Failure handling | Failed imports/jobs produce actionable errors and do not partially corrupt canonical data. |
| LLM failure | If the AI provider is unavailable, deterministic dashboard/opportunity functions continue working. |

### Demo dataset

Before connecting real patient data, create a synthetic dataset of at least 1,000 patients, 3,000 transactions, appointments, prescriptions, contact-lens purchases and campaign events. Include deliberately tricky cases: duplicate names, shared family phone numbers, missing DOBs, invalid phone numbers, patients with no consent, multiple purchases on the same day, cancelled appointments, unusually high-value customers and incomplete records.

### Golden test cases

1. Patient overdue for recall appears in the correct segment.
2. Patient with recent recall does not appear as overdue.
3. CL patient due for replenishment appears only when configured conditions are satisfied.
4. Patient with no marketing permission is excluded from a marketing campaign.
5. Duplicate patient candidates are not silently merged.
6. AI cannot invent missing facts.
7. Owner's revenue question returns calculations from database tools rather than invented numbers.
8. Practice A cannot retrieve Practice B through direct API, UI filters or AI queries.

## 13. Roadmap after MVP

| Stage | Product expansion |
| --- | --- |
| V0.1 | Revenue Operator: data import → opportunities → approved outreach → measurement. |
| V0.2 | Live connectors, beginning with accessible authorised APIs (Plato is a candidate), richer appointment workflows, improved segmentation and automated refresh. |
| V0.3 | Inventory intelligence: slow movers, stock-out risk, branch transfers and demand forecasting. |
| V0.4 | Operations Agent: daily staff tasks, uncollected orders, follow-up queues and workflow automation. |
| V0.5 | Business Intelligence Agent: natural-language practice analysis and anomaly detection. |
| V1 | Multi-agent Optical Operator: Patient + Marketing + Inventory + Business + Operations agents connected through a shared action layer. |
| Later | Aggregated, properly governed benchmarking; deeper vendor integrations; medical eye-clinic workflows; broader eye-care intelligence/operating-layer functionality. |

### Long-term closed-loop example

Inventory Agent: identifies an overstocked product → Patient Agent: identifies appropriate existing customer segments → Marketing Agent: proposes an approved campaign → Operations Agent: handles follow-up → Business Agent: measures revenue and margin → results feed future prioritisation.

### What the product should eventually feel like

The owner should not need to know which report to run. They should be able to say:

```text
“What should my team work on today?”

“What opportunities am I missing?”

“Why did revenue fall?”

“Which patients are most appropriate to contact?”

“Can you prepare a campaign?”

“Which products are becoming slow-moving?”

“Show me what happened after our last campaign.”
```

The Operator should respond with evidence, recommended actions and clear human approval points.

## 14. Product principles for the development team

1. Action over dashboards: every important insight should lead to a possible action.
2. Evidence over AI confidence: show the underlying data and calculations.
3. Rules first, LLM second: use deterministic code for facts and calculations.
4. Human control: especially for patient communications and anything clinical.
5. Tenant isolation by design: never rely on prompts alone to separate customers.
6. Vendor agnostic: canonical model first; connectors second.
7. Do not replace the POS initially: create value on top of existing systems.
8. Measure ROI: every campaign and automation should have an observable outcome where feasible.
9. Fail safely: AI failure must not break core practice data.
10. Build for migration: imports and mappings should be versioned and auditable.
11. Keep the MVP narrow: prove one revenue/action loop before adding every possible AI feature.

## 15. Initial Codex instruction

Use the following as the first high-level instruction when starting the coding project. It is intentionally concise; the full specification above is the source of truth.

```text
You are building the AI Optical Operator MVP described in this specification.

Build a production-minded modular monolith web application for optical practices.

The MVP is NOT a POS replacement. Existing optical systems remain the system of record. Our application is a system of action that imports/receives practice data, normalises it into a universal optical data model, identifies patient/revenue opportunities, explains the evidence, generates editable patient communications, requires human approval, tracks campaign outcomes, and measures business results.

Implement in vertical slices:
1. authentication + tenant isolation
2. canonical database schema
3. CSV/XLSX import wizard
4. data validation + duplicate detection
5. deterministic opportunity engine
6. opportunity dashboard/detail pages
7. AI message/explanation layer
8. campaign approval workflow
9. mock communication provider
10. campaign analytics
11. audit log
12. synthetic demo dataset
13. automated tests, especially tenant isolation and AI hallucination safeguards.

Do not build autonomous clinical decision-making.
Do not allow the LLM to invent facts.
Do not allow patient communications to be sent without the configured approval workflow.
Do not expose one practice's data to another practice.
Use deterministic database/application logic for numerical calculations.
Keep LLM integration behind an abstraction so the model/provider can be changed later.

Before implementing a feature, update the relevant tests and preserve the architecture described in this specification.
```

## 16. Current regulatory references

The specification incorporates high-level considerations from Singapore's current official sources. These are development considerations, not legal advice.

- PDPC Advisory Guidelines on Personal Data in AI Recommendation and Decision Systems: protection obligations for service providers handling client personal data in AI systems, including data mapping/labelling and provenance practices.
- Singapore Health Information Act overview and implementation resources: health-information governance, contribution/access/protection frameworks and cybersecurity/data-security expectations.
- MOH Code of Practice for Data Portability: expectations for accurate and complete migration of healthcare records and client-centric migration practices.
