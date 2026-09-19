# DentalCore — Historical Handwritten Patient Record Migration V1
## Architectural & Engineering Design Specification (Revised V1.1)

**Branch Baseline**: `release/dentalcore-v1`  
**Status**: ARCHITECTURAL & ENGINEERING SPECIFICATION ONLY (DESIGN STAGE)  
**Target Actor**: Head Doctor Only (`requireRole('Head Doctor')`)  
**Scope**: Digitize legacy handwritten patient and visit records (10+ years archive, processed in batches up to 200 source pages/records)  
**Execution Constraints**: DESIGN ONLY. Zero code changes, zero migrations executed, zero database modifications, zero deployments, zero Git commits/merges.

---

## Architectural Corrections Summary (V1.1)
This revised specification incorporates four mandatory architectural corrections:
1. **Age & Gender Nullability**: Full codebase audit across 8 functional areas. Proposes `age Int?` and `gender String?` alongside `phone String? @unique` to eliminate fake defaults (`0`, `"Unknown"`) while maintaining complete backward compatibility.
2. **Historical Visit Date Semantics**: Explicit decoupling of clinical visit date (`Visit.visitDate`) from system database ingestion timestamp (`Visit.createdAt`). Definitive fallback rule: use `visitDate` when available, fallback to `createdAt` when null, retain `createdAt`/`importedAt` for system/audit timing without altering unrelated reporting.
3. **Source Document Storage**: Retains `IDocumentStorageProvider` interface. Explicitly prohibits production migration from relying on Render's ephemeral filesystem. Defines local filesystem adapter for dev/test only and ONE production cloud object-storage provider. Designates provider selection as the primary remaining deployment decision without inventing credentials.
4. **Batch Limit Clarification**: Strictly redefined as **maximum 200 source pages/records per batch** (evaluated at page-level across single images and multi-page PDFs, not merely file count).

---

## Table of Contents
- [A. Locked Six-Field Scope & Clinical Integrity](#a-locked-six-field-scope--clinical-integrity)
- [B. Comprehensive Codebase Audit](#b-comprehensive-codebase-audit)
- [C. Patient Identity Nullability Architecture (Phone, Age, Gender)](#c-patient-identity-nullability-architecture-phone-age-gender)
- [D. Historical Visit-Date Semantics & Fallback Rules](#d-historical-visit-date-semantics--fallback-rules)
- [E. Page-Bounded Upload Architecture](#e-page-bounded-upload-architecture)
- [F. Single-Provider OCR & Six-Field Extraction Pipeline](#f-single-provider-ocr--six-field-extraction-pipeline)
- [G. Mandatory Human Review Console](#g-mandatory-human-review-console)
- [H. Duplicate Handling & Explicit Decision Rules](#h-duplicate-handling--explicit-decision-rules)
- [I. Historical Patient & Visit Import Rules (Zero Side-Effects)](#i-historical-patient--visit-import-rules-zero-side-effects)
- [J. Batch, Resumption & Queue Architecture](#j-batch-resumption--queue-architecture)
- [K. Source Document Storage Architecture](#k-source-document-storage-architecture)
- [L. Security & Role-Based Access Control (RBAC)](#l-security--role-based-access-control-rbac)
- [M. Minimal Frontend Architecture](#m-minimal-frontend-architecture)
- [N. Minimal Backend Services & API Routes](#n-minimal-backend-services--api-routes)
- [O. Comprehensive Verification Strategy](#o-comprehensive-verification-strategy)
- [P. Remaining Deployment Decisions](#p-remaining-deployment-decisions)

---

## A. Locked Six-Field Scope & Clinical Integrity

The historical migration pipeline extracts and processes **strictly six basic fields**. Nothing more.

### 1. The Six Locked Fields
* **Patient Identity**:
  1. **Patient Name** (`String`, mandatory before import)
  2. **Phone Number** (`String`, normalized if present; `null` if missing)
  3. **Age** (`Int`, `null` if missing/unclear; never fabricated)
  4. **Gender** (`String`, `null` if missing/unclear; never fabricated)
* **Visit Details**:
  5. **Visit Date** (`DateTime`, mandatory before import; actual clinical historical date)
  6. **Reason for Visit** (`String`, `null` if missing/unclear; never fabricated)

### 2. Strict Exclusions
The module explicitly **does NOT extract, interpret, predict, or import**:
* ❌ Treatment details, dental procedures, or clinical notes
* ❌ Medicines, dosages, formulations, or prescriptions
* ❌ Medical/clinical diagnosis, ICD codes, or diagnostic NLP
* ❌ Odontogram data, tooth numbers, surfaces, or charting
* ❌ Payments, invoices, fees, balances, or billing ledger entries
* ❌ Treatment plans, follow-ups, or appointments
* ❌ Medical AI, diagnostic inference, or clinical decision support models

### 3. Core Clinical & Data Integrity Rules
* **Never invent patient identity data**: Absolute prohibition against synthetic defaults. No `age = 0`, no `gender = "Unknown"`, no `phone = "0000000000"` or `"9999999999"`. If not explicitly recorded on the historical record, fields remain `null`.
* **Never invent visit information**: If the reason for visit is missing or illegible, it remains `null`. No `"Historical Consultation"`, `"Checkup"`, or placeholder complaints.
* **Mandatory Pre-Import Validation**: `Patient Name` and `Visit Date` must be confirmed and present before any record can be marked `APPROVED` or imported.
* **One Processed Record = One Historical Visit**: Each processed historical record corresponds to exactly one clinical visit. If a physical card or page contains multiple historical dates/entries that cannot safely and cleanly be represented as a single visit, it must be marked `Needs Review` for Head Doctor manual resolution.

---

## B. Comprehensive Codebase Audit

An exhaustive audit of the `release/dentalcore-v1` codebase was performed to evaluate schema constraints, data assumptions, and call sites across all layers:

### 1. Patient Model Audit (`Patient.age` and `Patient.gender`)
Current database schema (`server/prisma/schema.prisma`):
```prisma
model Patient {
  id        String    @id @default(uuid())
  name      String
  phone     String    @unique
  age       Int       // Currently NOT NULL
  gender    String    // Currently NOT NULL
  ...
}
```

Audit across 8 functional areas:
1. **Patient Creation & Edit Forms**:
   - `src/pages/Patients.tsx` (line 126): Live walk-in form requires `name`, `phone`, `age`, `gender`.
   - `src/pages/ReceptionDeskPage.tsx` (lines 731, 2026): Registration form validates and parses age/gender for active reception desk check-ins.
   - `src/pages/Dashboard.tsx` (lines 173-174): Quick-registration parses age/gender for active clinic walk-ins.
   - *Impact*: Active clinic forms continue to enforce complete profile collection for new live walk-in patients.
2. **Validation**:
   - Backend `patientController.ts` passes `data.age` and `data.gender` into Prisma without custom validation guards; non-nullability was previously enforced solely by the database engine.
3. **Controllers & Services**:
   - `server/src/controllers/patientController.ts` (`createPatient`, `updatePatient`): Passes `data.age` and `data.gender`. `getAllPatients` optionally filters by `where.gender = gender`.
   - `server/src/controllers/patientHistoryController.ts` (lines 103-104): Emits `{ age: patient.age, gender: patient.gender }`.
   - `server/src/services/reportsService.ts` (lines 671-672, 752-753): Maps `age: p.age, gender: p.gender` into export objects.
4. **Frontend Rendering & Safe Navigation**:
   - `src/pages/Patients.tsx` (line 113): `age: patient.age.toString()` — calls `.toString()` directly on edit drawer open. **Requires safe navigation**: `patient.age?.toString() || ''`.
   - `src/pages/ReceptionDeskPage.tsx` (line 568): `age: patient.age.toString()` — calls `.toString()` directly. **Requires safe navigation**: `(patient.age ?? '').toString()`.
   - Table / Display Cells:
     - `src/pages/Patients.tsx` (line 281): `{row.original.age} Yrs • {row.original.gender}`
     - `src/pages/DoctorWorkspacePage.tsx` (lines 736-737, 1647): `{patient.age} Yrs, {patient.gender}`
     - `src/components/history/PatientCompleteHistory.tsx` (line 147): `{patient.age} Yrs • {patient.gender}`
     - `src/components/reports/PatientsReport.tsx` (line 112): `{row.original.age} yrs / {row.original.gender}`
     - *Safe Rendering Rule*: Render `{patient.age != null ? `${patient.age} Yrs` : '—'} • {patient.gender || '—'}` so null values display cleanly without literal `null` or broken formatting.
5. **Reports**:
   - `reportsService.ts` exports `age` and `gender` as JSON/CSV fields. Null values serialize naturally to empty strings or nulls in JSON.
6. **Documents & PDFs**:
   - `server/src/controllers/documentController.ts` (lines 37-38):
     ```typescript
     patientAge: visit.patient.age || '',
     patientGender: visit.patient.gender || '',
     ```
     Already contains fallback `|| ''`. Completely null-safe.
7. **Communication**:
   - `queueRunner.ts`, `appointmentController.ts`, `NotificationService.ts`: Zero dependencies on `patient.age` or `patient.gender`.
8. **Tests**:
   - `tests/e2e/round2-persistence.spec.ts` (lines 40-41): Verifies standard patient persistence.
   - `server/verify_patient_import.ts` (lines 150-151, 201): Tests CSV patient import where age and gender are parsed from CSV columns.

### 2. Visit Model Audit (`Visit.createdAt` vs Clinical Date)
Current database schema (`server/prisma/schema.prisma`):
```prisma
model Visit {
  id              String        @id @default(uuid())
  patientId       String
  ...
  reasonForVisit  String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  ...
}
```
*Current Codebase Usage of `Visit.createdAt` as Clinical Date*:
- `server/src/controllers/patientHistoryController.ts` (line 50): Queries `orderBy: { createdAt: 'desc' }`.
- `src/components/history/PatientCompleteHistory.tsx` (line 202): `const visitDate = new Date(visit.createdAt)`.
- `src/pages/DoctorWorkspacePage.tsx` (lines 694, 1673, 1703): Sorts and displays previous visits using `new Date(visit.createdAt || Date.now())`.
- `server/src/controllers/documentController.ts` (line 42): `visitDate: visit.createdAt.toLocaleDateString('en-IN')`.
- `server/src/services/reportsService.ts` (lines 19, 121, 214, 278, 328, 599, 665, 746): Filters and groups visits by `createdAt`.
- *Audit Finding*: The codebase currently relies on `createdAt` because no clinical visit date column existed. Overloading `createdAt` with a 2015 historical date would destroy system audit timestamps. Conversely, keeping `createdAt = now()` without a dedicated clinical date column would place 10-year-old visits into today's timeline and corrupt daily clinic reporting.

---

## C. Patient Identity Nullability Architecture (Phone, Age, Gender)

### 1. Architectural Decision
To eliminate all fabricated defaults (`0`, `"Unknown"`, fake phone numbers) and accurately model physical handwritten records:

**Propose additive nullability on the `Patient` model:**
* `phone String? @unique`
* `age Int?`
* `gender String?`

### 2. Database Migration Specification (Proposed — DO NOT EXECUTE YET)
```sql
-- Migration: 2026xxxxxx_allow_nullable_patient_identity_fields
ALTER TABLE "Patient" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Patient" ALTER COLUMN "age" DROP NOT NULL;
ALTER TABLE "Patient" ALTER COLUMN "gender" DROP NOT NULL;
```
Prisma schema update:
```prisma
model Patient {
  id                            String                  @id @default(uuid())
  name                          String
  phone                         String?                 @unique // Nullable for historical archives lacking phone
  age                           Int?                    // Nullable when unrecorded on legacy card
  gender                        String?                 // Nullable when unrecorded on legacy card
  status                        String                  @default("Active")
  preferredCommunicationChannel CommunicationPreference @default(AUTO)
  createdAt                     DateTime                @default(now())
  updatedAt                     DateTime                @updatedAt
  ...
}
```

### 3. Compatibility & Safety Verification
* **PostgreSQL Uniqueness Semantics**: In PostgreSQL, standard unique constraints permit multiple `NULL` values. Distinct patients with `phone = NULL` do not collide. Any non-null phone remains strictly unique.
* **Live Clinic Protection**: Active registration in `Patients.tsx` and `ReceptionDeskPage.tsx` continues to require name, 10-digit phone, age, and gender for live patients.
* **Safe Navigation Call Sites**: The minor frontend locations identified in the audit (`Patients.tsx:113` and `ReceptionDeskPage.tsx:568`) will use safe navigation (`patient.age?.toString() || ''`) when historical records are viewed or edited in the UI.

---

## D. Historical Visit-Date Semantics & Fallback Rules

To preserve clinical chronological fidelity while maintaining an immutable system ingestion audit trail:

### 1. Database Model Decoupling
```prisma
model Visit {
  id              String        @id @default(uuid())
  patientId       String
  doctorId        String?
  appointmentId   String?       @unique
  status          String
  amountDue       Float         @default(0)
  consultationFee Float?
  treatmentFee    Float?
  medicineCost    Float?
  reasonForVisit  String?
  paymentOwner    String        @default("RECEPTION")
  visitDate       DateTime?     // Actual clinical/historical visit date
  createdAt       DateTime      @default(now()) // System ingestion/import timestamp (immutable audit log)
  updatedAt       DateTime      @updatedAt
  ...
  @@index([visitDate])
}
```

### 2. Proposed Minimal Migration (DO NOT EXECUTE YET)
```sql
-- Migration: 2026xxxxxx_add_visit_date_to_visit
ALTER TABLE "Visit" ADD COLUMN "visitDate" TIMESTAMP(3);
CREATE INDEX "Visit_visitDate_idx" ON "Visit"("visitDate");
```

### 3. The Authoritative Fallback Rule
Across all services, controllers, and frontend displays:
1. **Clinical & Timeline Date**:
   - **Use `visit.visitDate` when present** (historical migrated visits).
   - **Fallback to `visit.createdAt` when `visit.visitDate` is null** (existing live visits created prior to migration).
   - *Expression*: `const effectiveVisitDate = visit.visitDate ? new Date(visit.visitDate) : new Date(visit.createdAt);`
2. **System Ingestion & Audit Timing**:
   - **Continue using `Visit.createdAt` and `HistoricalMigrationRecord.importedAt`** for database insertion timing, system syncs, and operational audit logs.
   - Do NOT overwrite or spoof `createdAt` with historical dates.
3. **Reporting & Analytics Isolation**:
   - Daily/monthly operational KPI reports (e.g. daily collections, reception desk volume) track active clinic operations and must not be retroactively distorted by migrating 100 historical records from 2016 today.
   - Clinical timeline reporting and patient profile history use the effective clinical date (`COALESCE(visitDate, createdAt)`).
   - Financial ledger reporting (payments, revenue) continues to track immutable `Payment.createdAt` and is completely unaffected.

---

## E. Page-Bounded Upload Architecture

```
[ Head Doctor ] ──(Upload up to 200 pages)──► [ POST /api/historical-migration/batches ]
                                                          │
                               ┌──────────────────────────┴──────────────────────────┐
                               ▼                                                     ▼
                     [ Page Count Validator ]                              [ PDF Decomposer ]
                (Total pages across files <= 200)                      (Split into page images)
                               │                                                     │
                               └──────────────────────────┬──────────────────────────┘
                                                          ▼
                                            [ Source Storage Provider ]
                                       (Local adapter for dev / Cloud for prod)
                                                          │
                                                          ▼
                                            [ Create Batch & Records ]
                                       - Batch: HistoricalMigrationBatch
                                       - Records: HistoricalMigrationRecord (1 per page)
                                                          │
                                                          ▼
                                            [ In-Process OCR Worker ]
```

### 1. Strict Page-Level Limit (Maximum 200 Source Pages/Records)
The batch limit is strictly bounded by **source pages/records**, NOT simply file count:
* **Allowed**: 200 individual image scans (`.jpg`, `.png`).
* **Allowed**: 150 individual image scans.
* **Allowed**: One PDF document containing 180 pages.
* **Allowed**: Multiple PDFs and images whose combined page count is 200.
* **REJECTED**: One PDF document containing 500 pages (rejected at pre-validation before OCR processing).
* **REJECTED**: Any combination of files totaling > 200 pages.

### 2. Pre-Validation Enforcement
* **Frontend Pre-Flight**: Uses `pdfjs` or metadata reader to sum pages across all selected PDFs and image files before upload. If `totalCount > 200`, the upload button is disabled with an explanatory prompt.
* **Backend Multipart Inspection**: Streams headers of uploaded PDFs (`pdf-lib`) to extract page counts immediately. If cumulative page count exceeds 200, the request is rejected with `HTTP 400 Bad Request: "Batch exceeds the limit of 200 source pages. Total pages submitted: X."`
* **Resource Predictability**: Bounding batches to 200 pages caps working memory usage below 150MB, prevents gateway timeouts on Render, and keeps human review sessions focused and manageable.

---

## F. Single-Provider OCR & Six-Field Extraction Pipeline

```
[ Page Image ] ──► [ IOcrProvider ] ──► [ Raw Text Lines ] ──► [ Deterministic Heuristics ] ──► [ Proposed 6 Fields ]
                   (Single Server Provider)                      (Zero Clinical NLP)             (Stored on MigrationRecord)
```

### 1. Single Provider Interface
No multiple OCR runtime switching. A single, focused abstraction:
```typescript
export interface IOcrProvider {
  extractText(imageBuffer: Buffer): Promise<{
    rawText: string;
    confidence: number;
    lines: Array<{ text: string; confidence: number }>;
  }>;
}
```
* **Production Implementation**: Exactly **ONE** provider is configured server-side (Google Cloud Vision API `DOCUMENT_TEXT_DETECTION`).
* **Zero Client-Side Exposure**: Service account keys and API secrets reside strictly in server `.env`.

### 2. Strict Deterministic Heuristics (Six Fields Only)
The parser extracts only the six designated fields using regex and rule-based token matching:

| Field | Extraction Pattern & Heuristic | If Missing or Unclear |
|---|---|---|
| **1. Patient Name** | Prefixes: `Pt:`, `Patient:`, `Name:`, `Shri`, `Smt`, `Mr`, `Mrs`, `Dr`. First alphabetical non-header line. | **`null`**. Flagged for mandatory review. |
| **2. Phone Number** | Standard Indian mobile regex: `(?:(?:\+|0{0,2})91[\s-]*)?([6-9]\d{9})`. Normalized to 10 digits. | **`null`**. Flagged for review. Never fake phone. |
| **3. Age** | Tokens: `Age:`, `Yrs:`, `Y`, `Age/Sex` patterns (e.g., `42 Yrs`, `Age: 35`, `28/M`). Range 1–110. | **`null`**. Flagged for review. Never default to 0. |
| **4. Gender** | Tokens: `M`, `F`, `Male`, `Female`, `Transgender`, `M/`, `/F`. | **`null`**. Flagged for review. Never default to "Unknown". |
| **5. Visit Date** | Regex for standard date patterns: `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YY`, `DD Mon YYYY`. | **`null`**. Flagged for review. Never default to today. |
| **6. Reason for Visit** | Prefixes: `C/O:`, `Complaint:`, `Pain`, `Caries`, `Swelling`, `Cleaning`, `Extraction`, `RCT`, `Checkup`. | **`null`**. Flagged for review. Never placeholder text. |

### 3. Absolute Proposal Isolation
* OCR output populates **only** the staging record (`proposedName`, `proposedPhone`, `proposedAge`, `proposedGender`, `proposedVisitDate`, `proposedReason`).
* Zero writes occur in `Patient` or `Visit` tables during OCR extraction.

---

## G. Mandatory Human Review Console

Human review by the Head Doctor is an **unskippable architectural gate**.

```
+----------------------------------------------------------------------------------------------------+
| Batch #2026-001: Legacy Box 4 (Page 14 of 180)                             [ Status: Needs Review ]|
+----------------------------------------------------+-----------------------------------------------+
|                                                    |  PROPOSED 6 FIELDS (Head Doctor Correction)   |
|  ORIGINAL HANDWRITTEN SCAN (Source Page)           |                                               |
|  +----------------------------------------------+  |  Patient Name * (Mandatory)                   |
|  |                                              |  |  [ Ravi Kumar                    ]            |
|  |   Dr. Dental Clinic                          |  |                                               |
|  |   Date: 12/06/2016                           |  |  Phone Number (Blank if missing)              |
|  |   Pt: Ravi Kumar                             |  |  [ 9876543210                    ]            |
|  |   Age: 42   Sex: M                           |  |                                               |
|  |   Ph: 9876543210                             |  |  Age                   Gender                 |
|  |   C/O: Severe lower molar pain               |  |  [ 42          ]       [ Male            v ]  |
|  |                                              |  |                                               |
|  |                                              |  |  Visit Date * (Mandatory) Reason for Visit       |
|  |                                              |  |  [ 12/06/2016  ]       [ Lower molar pain]    |
|  |                                              |  |                                               |
|  |                                              |  |  DUPLICATE CHECK:                             |
|  |                                              |  |  (!) Possible Duplicate Found:                |
|  |                                              |  |      "Ravi Kumar (9876543210)" - Age 42, Male |
|  |  [ Zoom In ] [ Zoom Out ] [ Rotate ] [ Reset] |  |  (o) Use Existing Patient  ( ) Create New     |
|  +----------------------------------------------+  +-----------------------------------------------+
|                                                    |  [ Skip Record ]   [ Save Draft ]  [ Approve ]|
+----------------------------------------------------------------------------------------------------+
```

### Reviewer Capabilities & Constraints
1. **Side-by-Side Canvas**: High-resolution image canvas with zoom, pan, and 90° rotation.
2. **Mandatory Invariants**:
   - `Patient Name` must not be blank before approval.
   - `Visit Date` must not be blank and must represent a valid past date.
   - `Phone`, `Age`, `Gender`, and `Reason for Visit` can be left blank (`null`) if absent from the physical document.
3. **Multi-Visit Safeguard**: If a physical document card contains multiple historic visits that cannot be unambiguously captured as a single visit record, the Head Doctor flags or splits the card.
4. **Resumable State**: Every decision is persisted immediately in PostgreSQL. The reviewer can pause at record 45 and resume days later.

---

## H. Duplicate Handling & Explicit Decision Rules

The system **never silently merges or links uncertain duplicates**.

```
Candidate Record
       │
       ├─► Normalized Phone Matches Existing Patient?
       │         ├─► Yes: Name Matches?
       │         │         ├─► Yes ──► EXACT_MATCH ──► Suggests: [Use Existing Patient]
       │         │         └─► No  ──► PHONE_CONFLICT ──► Requires Reviewer Choice: [Use Existing] / [Create New]
       │         │
       │         └─► No / Phone is Null
       │                   ├─► Name Matches Existing Patient?
       │                   │         ├─► Yes ──► Compares Age/Gender ──► Flags POSSIBLE_DUPLICATE
       │                   │         └─► No  ──► Suggests: NEW_PATIENT
       │                   │
       │                   └─► Phone Unique & Name Unique ──► Suggests: NEW_PATIENT
```

### Explicit Reviewer Choice
For every record, the Head Doctor explicitly selects one of three actions:
* **`[Use Existing Patient]`**: Links the historical visit to the matched patient record (`matchedPatientId`). No new patient is created.
* **`[Create New Patient]`**: Creates a new patient record with nullable fields populated if detected.
* **`[Skip]`**: Omits the record from import (e.g. blank page, illegible scan).

---

## I. Historical Patient & Visit Import Rules (Zero Side-Effects)

When the Head Doctor initiates import of approved records:

### 1. Atomic Database Transaction
```typescript
await prisma.$transaction(async (tx) => {
  let targetPatientId = record.matchedPatientId;

  // 1. Create Patient if marked CREATE_NEW
  if (record.duplicateResolution === 'CREATE_NEW') {
    const patient = await tx.patient.create({
      data: {
        name: record.reviewedName!,
        phone: record.reviewedPhone || null, // Clean null, never fake phone
        age: record.reviewedAge ?? null,      // Clean null, never fake 0
        gender: record.reviewedGender ?? null,// Clean null, never fake "Unknown"
        status: 'Active',
        preferredCommunicationChannel: 'AUTO'
      }
    });
    targetPatientId = patient.id;
  }

  // 2. Create Historical Visit
  const visit = await tx.visit.create({
    data: {
      patientId: targetPatientId!,
      status: 'COMPLETED',
      visitDate: record.reviewedVisitDate!, // Actual clinical historical date
      reasonForVisit: record.reviewedReason || null, // Clean null, never fake complaint
      amountDue: 0,
      consultationFee: 0,
      treatmentFee: 0,
      medicineCost: 0,
      paymentOwner: 'RECEPTION',
      createdAt: new Date() // Immutable system database creation timestamp
    }
  });

  // 3. Mark Migration Record as IMPORTED
  await tx.historicalMigrationRecord.update({
    where: { id: record.id },
    data: {
      status: 'IMPORTED',
      importedPatientId: targetPatientId,
      importedVisitId: visit.id,
      importedAt: new Date()
    }
  });
});
```

### 2. Zero Collateral Side-Effects
To protect the live clinic environment from corruption:
* ❌ Zero `Appointment` records created.
* ❌ Zero `Consultation` records created.
* ❌ Zero `Prescription` or medicine items created.
* ❌ Zero `Payment` or ledger entries created.
* ❌ Zero `TreatmentPlan` or plan items created.
* ❌ Zero `Notification` or messaging events queued.

---

## J. Batch, Resumption & Queue Architecture

### 1. PostgreSQL In-Process Queue (No Redis/Kafka/BullMQ)
* State management runs natively in PostgreSQL using row-level locking (`FOR UPDATE SKIP LOCKED`).
* Eliminates operational overhead of external message brokers on Render.
* **Crash Recovery Sweeper**: On server boot, `recoverStaleMigrationJobs()` resets any records stuck in `PROCESSING` back to `NEEDS_REVIEW`.
* **Resumability**: Batches maintain granular states (`UPLOADED`, `OCR_PROCESSING`, `AWAITING_REVIEW`, `IMPORTING`, `COMPLETED`). Review progress is tracked per record.

### 2. Chunked Transaction Execution
* Approved records are imported in transactions of **25 records**.
* If record #52 fails, records #1–50 remain committed. Record #52 displays an error for immediate inline correction and retry.

---

## K. Source Document Storage Architecture

### 1. Provider Abstraction
```typescript
export interface IDocumentStorageProvider {
  saveDocument(buffer: Buffer, key: string, contentType: string): Promise<string>;
  getDocumentStream(key: string): Promise<NodeJS.ReadableStream>;
  deleteDocument(key: string): Promise<void>;
}
```

### 2. Storage Adapter Rules
* **Local Development & Testing Adapter (`LocalStorageProvider`)**:
  - Stores scans under `storage/historical_migration/{batchId}/{recordId}.jpg`.
  - Intended strictly for local development and offline unit/integration test runs.
* **Production Deployment Rule**:
  - **Do NOT allow production Historical Migration to depend on Render's ephemeral local filesystem.** On Render, local filesystem contents are ephemeral and destroyed upon instance restart, autoscaling, or deployment.
  - Historical scans must remain retrievable across months of audits and reviews.
  - **ONE production cloud object-storage provider** (e.g. AWS S3-compatible bucket, Cloudflare R2, or Google Cloud Storage) will be utilized for deployment.
  - Do not implement multiple providers or ad-hoc multi-cloud abstractions.
  - The specific provider choice is explicitly designated as the **only remaining deployment decision**. Zero credentials or provider-specific code are implemented in V1 design.

### 3. Authenticated Access Security
* Source document files are **never served as public static assets**.
* Images are streamed strictly through authenticated, role-gated endpoints (`GET /api/historical-migration/records/:id/preview`).

---

## L. Security & Role-Based Access Control (RBAC)

1. **Strict Head Doctor Boundary**:
   ```typescript
   router.use('/api/historical-migration', requireAuth, requireRole('Head Doctor'));
   ```
   - Receptionists, Duty Doctors, and Accountants receive immediate **HTTP 403 Forbidden**.
2. **Credential Privacy**:
   - OCR API keys and cloud storage secrets exist solely in server-side `.env`.
3. **Audit & Log Hygiene**:
   - PHI (patient names, phones, handwritten scan images) is never logged in console standard output.

---

## M. Minimal Frontend Architecture

* **Target Location**: Accessible only to `Head Doctor` under **Settings → Historical Migration** (with quick-access link on `/patients`).
* **Component Set**:
  1. `HistoricalMigrationPage.tsx`: Batch management table with progress bars, status badges, and `[Resume Review]` / `[Upload Batch]` buttons.
  2. `BatchUploadModal.tsx`: File dropzone with pre-flight page-counter validating the **maximum 200 source pages** limit.
  3. `HistoricalReviewWorkspace.tsx`: Side-by-side verification console with pan/zoom canvas, 6-field inputs, and duplicate resolution controls.
  4. `BatchResultsSummaryModal.tsx`: Post-import statistics (patients created, visits linked, records skipped).

---

## N. Minimal Backend Services & API Routes

### Directory Structure
```
server/src/
├── controllers/
│   └── historicalMigrationController.ts
├── routes/
│   └── historicalMigrationRoutes.ts
└── services/
     └── historicalMigration/
         ├── HistoricalBatchService.ts      # Upload, page validation, PDF decomposition
         ├── OcrProcessorService.ts         # Single IOcrProvider & 6-field regex rules
         ├── DuplicateMatchingService.ts    # Phone/name matching logic
         ├── HistoricalImportService.ts     # Chunked transactional import
         ├── LocalStorageProvider.ts        # Dev/test storage adapter
         └── CloudStorageProvider.ts        # Single production object-storage adapter
```

### API Routes (`requireRole('Head Doctor')`)
* `POST   /api/historical-migration/batches` — Upload files & create batch (enforces <= 200 pages).
* `GET    /api/historical-migration/batches` — List migration batches with progress.
* `GET    /api/historical-migration/batches/:batchId` — Get batch statistics.
* `GET    /api/historical-migration/batches/:batchId/records` — Fetch records for review.
* `GET    /api/historical-migration/records/:recordId/preview` — Authenticated image stream.
* `PATCH  /api/historical-migration/records/:recordId` — Save reviewer corrections.
* `POST   /api/historical-migration/records/:recordId/resolve` — Save duplicate decision.
* `POST   /api/historical-migration/batches/:batchId/import` — Execute chunked transactional import.

---

## O. Comprehensive Verification Strategy

1. **Page-Limit Verification**:
   - Verify upload of 200 single images succeeds.
   - Verify upload of one 180-page PDF succeeds.
   - Verify upload of multiple PDFs totaling 200 pages succeeds.
   - Verify upload of one 500-page PDF is rejected immediately with informative HTTP 400.
2. **Nullability & Non-Fabrication Verification**:
   - Verify extraction with missing phone produces `phone: null` (never `"0000000000"`).
   - Verify extraction with missing age produces `age: null` (never `0`).
   - Verify extraction with missing gender produces `gender: null` (never `"Unknown"`).
   - Verify extraction with missing reason produces `reasonForVisit: null` (never placeholder text).
   - Verify that patients with `phone = null` coexist in PostgreSQL without unique constraint violations.
3. **Date Semantics Verification**:
   - Verify imported historical visit has `visitDate = 2016-06-12` and `createdAt = current_timestamp`.
   - Verify patient history timeline renders `2016-06-12` as the clinical visit date.
   - Verify that running daily clinic operational reports for today does not count historical visits.
4. **Side-Effect Invariance Verification**:
   - Verify importing 50 records increases only `Patient` and `Visit` tables.
   - Verify counts of `Appointment`, `Consultation`, `Prescription`, `PrescriptionItem`, `Payment`, `TreatmentPlan`, and `Notification` remain **exactly zero**.
5. **RBAC Security Verification**:
   - Verify Receptionist and Duty Doctor receive HTTP 403 Forbidden.
   - Verify Head Doctor receives HTTP 200/201.
6. **Resumption & Storage Verification**:
   - Verify reviewing 20 records and closing browser retains all progress.
   - Verify source document scans are served only via authenticated preview routes.

---

## P. Remaining Deployment Decisions

Before implementation begins, the following single deployment decision remains:

* **Production Object-Storage Provider Selection**:
  - The production cloud storage bucket provider (e.g. AWS S3, Cloudflare R2, or Google Cloud Storage) must be designated for the production environment so Render's ephemeral filesystem is not used for legacy document retention.
  - Once designated, the single production adapter will be configured using standard server environment variables. Zero credentials are to be invented or committed in code.

---
*No code modifications, migrations, database mutations, deployments, or Git commits/merges were executed in accordance with your instructions.*
