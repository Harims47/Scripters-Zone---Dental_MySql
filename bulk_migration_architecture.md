# DentalCore Data Migration & Intake — Full Architecture & OCR Specification

**Document Version:** 1.0.0
**Status:** ARCHITECTURE DESIGN & AUDIT (PRE-IMPLEMENTATION)
**Target Systems:** DentalCore Core Backend, PostgreSQL Storage, OCR Processing Pipeline, Review Interface
**Scope:** Ingestion, Parsing, Matching, Human Review, and Historical Archival of Structured, Digital, Scanned, and Handwritten Clinical Records.

---

## 1. Current Schema Audit

To anchor data migration in existing ground truth, we examine the active Prisma schema (`server/prisma/schema.prisma`):

| Existing Entity | Relevant Migration Fields | Migration Constraints & Challenges |
| :--- | :--- | :--- |
| **`Patient`** | `id`, `name`, `phone` (UNIQUE), `age`, `gender`, `status`, `photoUrl`, `address`, `email`, `preferredCommunicationChannel`, `whatsappAvailable` | **Strict Unique Constraint on `phone`**: Every incoming patient in DentalCore must possess a unique phone number. Legacy records frequently lack phone numbers (e.g. pediatric/geriatric records, rural clinics), have placeholder phones (e.g. `0000000000`, `9999999999`), or share a family phone number across multiple household members. |
| **`Appointment`** | `id`, `patientId`, `providerId`, `date`, `time`, `type`, `status`, `notes` | Requires link to `patientId`. Date/Time stored as strings (`date: "YYYY-MM-DD"`, `time: "HH:mm"`). |
| **`Visit`** | `id`, `patientId`, `doctorId`, `appointmentId`, `status`, `amountDue`, `consultationFee`, `treatmentFee`, `medicineCost`, `reasonForVisit`, `paymentOwner` (`RECEPTION` vs `DOCTOR`) | Central operational hub. Historical visits must distinguish between active operational queue visits and closed historical encounters (`status: "Completed"`). Must assign `paymentOwner`. |
| **`Consultation`** | `id`, `visitId` (1:1), `doctorId`, `reasonForVisit`, `clinicalNotes`, `consultationFee`, `treatmentFee`, `status` | Requires an existing `visitId` and attending `doctorId`. Clinical notes are plain unstructured text. |
| **`Prescription` & `PrescriptionItem`** | `prescription.visitId` (1:1), `prescriptionItem.medicineId` (FK to `Medicine`), `quantity`, `dosage`, `frequency`, `instructions` | **Strict Relational Dependency**: `PrescriptionItem` requires a foreign key pointing to an active, cataloged `Medicine` record in the clinic's inventory. Historical free-text prescriptions (e.g., *"Tab. Amox 500 TDS 5d"*) cannot be inserted as structured `PrescriptionItem` rows unless the medicine matches an existing inventory item. |
| **`TreatmentPlan` & `TreatmentPlanItem`** | `treatmentPlan.patientId` (1:1), `treatmentPlanItem.treatmentCatalogId` (FK to `TreatmentCatalog`), `status` (`Planned` vs `Completed`), `completedVisitId`, `notes` | Requires valid `treatmentCatalogId`. Historical procedures (e.g., *"Extracted 46"*, *"RCT 16"*) must map to catalog procedures or be stored in clinical notes. |
| **`Payment`** | `id`, `visitId`, `patientId`, `amount`, `method`, `status`, `date` | Requires existing `visitId` and `patientId`. Historical accounting cannot be mixed with active daily ledger reconciliation without dedicated historical flags. |
| **`Document` / `PatientDocument`** | *Non-existent in current schema* | **Architectural Void**: DentalCore currently has **no entity** for storing uploaded patient documents, historical PDFs, scanned images, lab reports, or source migration files. All existing document routes only synthesize dynamic PDFs on the fly. |

### Required Future Schema Additions (Non-Breaking)
To support migration without altering clinic operations, three new model clusters will be required in a future migration:
1. `MigrationBatch` & `MigrationRecord`: Tracks raw uploads, parsing states, field extractions, and review statuses.
2. `PatientDocument` / `SourceDocumentArchive`: Retains original scanned PDFs/images, hashes, OCR payloads, and links to verified `Patient` records.
3. `LegacyIdentifier`: Maps external Clinic IDs, OP Numbers, or Chart Numbers (`externalSource`, `externalId`) to internal `patientId` UUIDs.

---

## 2. Source Format Strategy

The intake pipeline must process diverse data sources across four architectural tiers:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DENTALCORE INTAKE & MIGRATION PIPELINE                          │
└──────────────────────────────────┬─────────────────────────────────────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
[ Tier A: Structured ]    [ Tier B: Digital Docs ]    [ Tier C: Scanned/Unstructured ]
  - CSV (RFC 4180)          - Searchable PDF            - Scanned PDF / Image (JPG, PNG)
  - Excel (XLSX, XLS)       - Generated EMR Reports     - Mobile Photos of Records
  - EMR JSON / SQL Dumps    - Exported Billing Docs     - Handwritten Notes & Case Sheets
       │                           │                           │
       ▼                           ▼                           ▼
[ Streaming Table Parser ] [ PDF Text / Stream Parser ] [ Preprocessing & OCR Engine ]
  (Worker: PapaParse/ExcelJS)   (pdf-parse / pdf2json)    (Deskew, Binarize, Segment, OCR)
       │                           │                           │
       └───────────────────────────┼───────────────────────────┘
                                   │
                                   ▼
                   [ Raw Extracted Intermediate Token ]
                                   │
                                   ▼
             [ Extraction, Normalization & LLM Interpretation ]
                                   │
                                   ▼
                    [ Confidence Scoring & Routing ]
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
         [ HIGH (>=95%) ]                  [ MEDIUM / LOW (<95%) ]
         (Patient Master)                 (Clinical Notes, Hand-written)
                  │                                 │
                  ▼                                 ▼
        [ Direct Pre-commit ]             [ Human Review Queue ]
                  │                                 │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
             [ Transactional Commit to DentalCore PostgreSQL ]
```

### Format Tiers
1. **Tier A: Structured (CSV, XLSX, JSON)**
   - High fidelity, deterministic schema mapping, zero OCR ambiguity.
   - Handled via streaming batch pipelines (chunk size: 500 rows).
2. **Tier B: Digital Native Documents (Searchable PDFs, HTML exports)**
   - Embedded font/text streams extracted directly via native PDF object tree traversal without optical rasterization.
   - Preserves character precision, eliminates font rendering artifacts.
3. **Tier C: Scanned Bitmaps (Scanned PDFs, TIFF, JPG, PNG)**
   - Rasterized document sheets requiring computer vision preprocessing, contrast stretching, deskewing, and high-resolution optical character recognition.
4. **Tier D: Handwritten Clinical Records & Case Sheets**
   - Non-standard cursive handwriting, medical abbreviations, shorthand charting notations (Palmer/FDI tooth numbers).
   - Requires specialized Handwriting Recognition (ICR) followed by contextual medical semantic parsing and **mandatory human verification**.

---

## 3. Excel/CSV Migration Pipeline

```
[ Upload File (.xlsx, .csv) ]
             ↓
[ Stream Hash & Magic Bytes Validation ]
             ↓
[ Header Analysis & Semantic Column Mapping ]
             ↓
[ Row-by-Row Streaming Validation ]
             ↓
[ Normalization: Phones (E.164), Dates (ISO 8601), Genders ]
             ↓
[ Conservative Deduplication & Match Evaluation ]
             ↓
[ Batch Insert: Transactional 500-Row Chunks ]
```

### 1. Ingestion & Streaming
- To prevent Node.js heap exhaustion on 50,000+ row files (which crash typical in-memory `multer` or `fs.readFileSync` buffers), files are streamed directly to a temporary staging volume.
- CSV streams are parsed using `csv-parser` or `PapaParse` streaming transforms.
- Excel files (`.xlsx`) are read via streaming SAX readers (`exceljs` streaming reader) to ensure memory footprint stays under **120 MB RAM** regardless of row count.

### 2. Header Mapping
The system matches source headers against standard target fields using phonetic and exact alias tables:

```typescript
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['patient_name', 'full_name', 'patient name', 'pt name', 'name', 'client_name'],
  phone: ['mobile', 'cell', 'phone', 'contact', 'telephone', 'mobile_no', 'phone_number'],
  age: ['age', 'pt_age', 'years', 'yrs'],
  gender: ['gender', 'sex', 'm/f'],
  address: ['address', 'residence', 'location', 'city', 'addr'],
  email: ['email', 'email_address', 'mail'],
  legacyId: ['op_number', 'op_no', 'patient_id', 'mrn', 'chart_no', 'record_no', 'file_no']
};
```

### 3. Validation & Sanitization
- **Phone Cleansing**: Strips non-digits; verifies 10-digit Indian standard or 12-digit E.164 (`+91`). If missing or invalid, marks record as `REQUIRES_PHONE_RESOLUTION`.
- **Gender Standardization**: Normalizes `["M", "Male", "m", "Boy"]` to `"Male"`, `["F", "Female", "f", "Girl"]` to `"Female"`, other strings to `"Other"`.
- **Age / DOB Calculation**: If Date of Birth is provided (`"1994-05-12"`), calculates dynamic age; if age integer is given, stores integer directly.

---

## 4. Digital & Scanned PDF Migration Pipeline

Digital PDFs contain mixed vector text, tabular layout structures, and raster images. The PDF pipeline bifurcates early based on content analysis:

```
[ PDF File Upload ]
         ↓
[ Inspect PDF Object Dictionary ]
         ├───────────────────────────────────────────────┐
         ▼                                               ▼
[ Searchable Text Layer Exists ]               [ Pure Raster Image Stream ]
         ↓                                               ↓
[ Extract Text Streams & Coordinates ]          [ PDF Page Rasterization (300 DPI) ]
         ↓                                               ↓
[ Layout-Aware Regex / Bounding Box Parser ]    [ Route to Computer Vision OCR Pipeline ]
```

### Technical Workflow
1. **Inspection**: Open PDF header using `pdfjs-dist` or `pdf-parse`.
2. **Text Density Metric**: Calculate character count per square inch across each page.
   - Density > 0.05 characters/px²: **Digital Document**. Direct text extraction bypasses OCR, reducing latency by 90% and eliminating character misrecognition.
   - Density ≤ 0.05 characters/px²: **Scanned Document**. Page is rasterized at **300 DPI** using `pdftoppm` or `pdf2pic` to generate clean PNG images for OCR processing.
3. **Multi-Page Handling**: Multi-page clinical charts are maintained as a unified sequence (`pageNumber` 1..N) tied to a single `sourceDocumentId`.

---

## 5. Image Migration Pipeline

Mobile photographs of patient cards taken by clinic assistants often suffer from non-planar perspective, shadow gradients, low contrast, and blur. Images undergo strict image quality enhancement before entering the OCR engine:

```
[ Raw Image (JPG/PNG) ]
         ↓
[ 1. Image Quality Metric (Sharpness/Blur check using Laplacian Variance) ]
         ↓
[ 2. Auto-Orientation & EXIF Rotation Normalization ]
         ↓
[ 3. Perspective Correction & Deskewing (Hough Transform / Contour Detection) ]
         ↓
[ 4. Adaptive Binarization (Sauvola / Bradley Thresholding for uneven lighting) ]
         ↓
[ 5. Noise Removal (Morphological Opening / Median Filter) ]
         ↓
[ High-Contrast 300+ DPI Preprocessed Output ]
```

- **Laplacian Variance Blur Check**: If variance < threshold (e.g. 100.0), the image is too blurry for reliable character recognition. The system immediately flags the record as `POOR_IMAGE_QUALITY` and routes it directly to manual intake rather than generating corrupt OCR guesses.

---

## 6. OCR Architecture & Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CORE OCR ENGINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Text Detection & Bounding Box Localization (Word/Line/Block Segmentation)│
│ 2. Character Recognition & Glyph Feature Mapping                            │
│ 3. Per-Word & Per-Character Confidence Score Generation (0.00 – 1.00)       │
│ 4. Geometry-Aware Token Extraction with (x, y, width, height) Coordinates   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
                  [ Raw HOCR / JSON Bounding Box Tokens ]
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 DENTAL-SPECIFIC HEURISTIC EXTRACTOR                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ - Anchor Keywords: "OP No:", "Patient:", "Age/Sex:", "Rx:", "Diagnosis:"    │
│ - Dental Shorthand Matchers: "RCT", "Ext", "Crown", "Impaction", "Scaling"  │
│ - Tooth Numbering Pattern Matchers (FDI 11-48, Palmer 1-8 quadrants)        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
                       [ Field Extraction Candidate ]
```

### Extraction & Parsing Logic
- Raw text alone loses tabular and spatial relationships. The OCR engine must return **bounding box geometry** (`x0, y0, x1, y1`) so horizontal alignment (e.g., `"Phone:"` located directly to the left of `"9876543210"`) is preserved as key-value pairs.
- **Tooth Numbering Rules**: Dental records frequently use FDI notations (e.g., `16`, `24`, `36`, `48`) or Palmer notations (e.g., `_|_6`). Heuristic extractors must never confuse an age (`"Age: 36"`) with a tooth notation (`"Treatment: RCT on 36"`).

---

## 7. Handwriting Recognition (ICR) Considerations

Handwriting Recognition (Intelligent Character Recognition - ICR) in clinical environments is fundamentally non-deterministic. Dental case sheets feature doctor cursive, non-standard abbreviations, shorthand drug doses, and varying ink degradation.

### Confidence Stratification Model

| Confidence Tier | Average Glyph Confidence | Policy for Clinical Data | Policy for Demographic Data |
| :--- | :--- | :--- | :--- |
| **HIGH** | `≥ 95%` | Requires 1-click confirmation | Auto-accepted if phone matches E.164 |
| **MEDIUM** | `75% – 94%` | **Mandatory Human Verification** | Highlighting field in Yellow for Review |
| **LOW** | `< 75%` | **Flagged as Tentative Draft** | Highlighted in Red; field left editable |

### Critical Rule on Clinical Data
> [!CAUTION]
> **Zero Automated Ingestion for Handwritten Clinical Data**:
> Under no circumstance may a handwritten diagnosis, prescription, drug name, or dosage be imported into the active patient chart without human confirmation. A misrecognized character in a drug name (e.g., *"Celebrex"* vs *"Celexa"*) or dosage (e.g., *"10mg"* vs *"100mg"*) represents an unacceptable patient safety liability.

---

## 8. AI Extraction & Medical NLP Layer

After optical character recognition produces raw text tokens, an **AI Medical NLP Extraction Layer** normalizes chaotic clinical notes into structured entities:

```
[ Raw OCR Text Stream ]
"42/M c/o throbbing pain lr6 since 3d. O/E deep carious lesion 46. Adv: RCT 46. Rx: Tab Augmentin 625 BD 5d, Tab Zerodol-SP BD 3d"
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AI CLINICAL INTERPRETATION LAYER                      │
│ (Strict System Prompt with Dental Nomenclature & Closed Vocabulary Binding) │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
[ Structured Extraction Proposal ]
{
  "demographics": { "age": 42, "gender": "Male" },
  "chiefComplaint": "Throbbing pain lower right first molar for 3 days",
  "diagnosis": "Deep dental caries in tooth 46 (lower right first molar)",
  "plannedProcedures": [
    { "catalogName": "Root Canal Treatment", "tooth": "46", "confidence": 0.96 }
  ],
  "prescription": [
    { "drug": "Augmentin", "strength": "625mg", "dosage": "1 tablet twice daily", "duration": "5 days", "confidence": 0.94 },
    { "drug": "Zerodol-SP", "strength": "", "dosage": "1 tablet twice daily", "duration": "3 days", "confidence": 0.91 }
  ]
}
```

### Three-State Verification Hierarchy
1. **`RAW_OCR_TEXT`**: Immutable verbatim output from the optical character reader.
2. **`AI_PROPOSED_DATA`**: Synthesized interpretation with confidence scores per field.
3. **`VERIFIED_CLINICAL_RECORD`**: Human-confirmed clinical record authored and signed by the doctor/staff prior to database commitment.

---

## 9. Conservative Patient Matching & Deduplication

Data migration must never create duplicate patient profiles or corrupt existing patient medical histories by merging records inappropriately.

### Matching Decision Engine

```
                                  [ Incoming Record ]
                                           │
                        Does Phone Number Match Existing Patient?
                                           │
                     ┌─────────────────────┴─────────────────────┐
                    YES                                          NO
                     │                                           │
      Does Exact Name Match?                       Does Legacy ID (MRN/OP No) Match?
         ┌───────────┴───────────┐                         ┌─────┴─────┐
        YES                      NO                       YES          NO
         │                       │                         │           │
   [ EXACT MATCH ]       [ PROBABLE MATCH ]        [ PROBABLE MATCH ] [ NO MATCH ]
  (Merge to Existing)   (Family Share Check)      (Phone Update Check) (Create New)
```

### Classification Matrix
1. **EXACT MATCH**: Same 10-digit Phone AND Name similarity ≥ 90% (Levenshtein distance).
   - *Action*: Attach incoming historical visits/documents to existing `patient.id`.
2. **PROBABLE MATCH (Phone Match, Different Name)**: Typical Indian clinic scenario where father, mother, and child all register under father's phone number.
   - *Action*: **Never auto-merge**. Flag as `POTENTIAL_FAMILY_MEMBER`. System prompts operator: *"Existing patient 'Ramesh Kumar' has this phone. Is incoming 'Suresh Kumar' a family member or a new patient?"*
3. **PROBABLE MATCH (Legacy ID Match, Different Phone)**: Same OP/Chart Number from old software, but phone has changed.
   - *Action*: Queue for operator review with diff view.
4. **NO MATCH**: New phone number, no conflicting legacy ID.
   - *Action*: Eligible for automatic creation after validation.

---

## 10. Historical Data Strategy: Structured vs Document Archive

A common defect in clinic migrations is attempting to convert 10 years of historical clinical notes into modern structured foreign-key entities (`PrescriptionItem`, `DispensingItem`, `Payment`). This frequently corrupts inventory stock counts and financial reports.

### Data Demarcation Boundary

| Historical Domain | Recommended Migration Target | Architectural Rationale |
| :--- | :--- | :--- |
| **Patient Demographics** | `Patient` (Active Master Record) | Foundation for SMS/WhatsApp notifications, check-ins, and future visit booking. |
| **Historical Treatment Notes** | `Consultation.clinicalNotes` (Text Block) | Stored as chronological medical narrative (e.g., `"[MIGRATED RECORD - 12/04/2021] RCT 16 completed by Dr. Sharma"`). Does NOT require retrospective catalog FK binding. |
| **Historical Prescriptions** | **Document Archive / Consultation Notes** | **CRITICAL**: Never insert historical medicines into `PrescriptionItem`. Doing so requires matching old brand names to current pharmacy stock and creates artificial dispensing histories. |
| **Historical Financials** | **Archived Summary in Notes** | Retain lifetime revenue in historical summary field; do not insert backdated rows into active daily cash/UPI registers to avoid skewing current financial audits. |
| **Original Scans / Case Sheets** | `PatientDocument` (Source Archive) | Preserves the authentic medicolegal original document permanently accessible in the patient's chart. |

---

## 11. Source Document Archive Architecture

Every scanned sheet, PDF, and image imported into DentalCore must remain permanently accessible for medicolegal compliance:

```
[ Uploaded Source Document ]
            │
            ├───────────────────────────────────────────┐
            ▼                                           ▼
[ Compute SHA-256 Checksum ]                [ Storage Provider Engine ]
(Prevents duplicate storage & verify tampering) (Local Disk / S3 Encrypted Storage)
            │                                           │
            └─────────────────────┬─────────────────────┘
                                  │
                                  ▼
[ PatientDocument Entity in PostgreSQL ]
  - id: UUID
  - patientId: FK -> Patient
  - originalFilename: string
  - storagePath: string
  - mimeType: string
  - fileSizeBytes: bigint
  - sha256Checksum: string
  - ocrRawText: Text (Full text searchable via tsvector)
  - ocrMetadata: Json (Bounding boxes, confidence, provider info)
  - verifiedByStaffId: FK -> Staff (Audit attribution)
  - retentionExpiresAt: DateTime? (Medicolegal retention window)
```

---

## 12. Human Review Workflow & Operator UI

The operator review interface is designed for high-velocity keyboard and visual verification:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ DENTALCORE MIGRATION VERIFICATION DESK                      Batch: Batch_2026_09_14_Scans   │
│ Record 42 of 500                                            Status: REQUIRES_REVIEW         │
├─────────────────────────────────────────────┬───────────────────────────────────────────────┤
│ ORIGINAL SCANNED SOURCE (Interactive Zoom)  │ EXTRACTED CLINICAL FIELDS (Side-by-Side Diff) │
├─────────────────────────────────────────────┼───────────────────────────────────────────────┤
│                                             │ Patient Name                                  │
│  [ Visual Document Preview with             │ [ Ravi Kumar                 ] [ ✓ 99% CONF ] │
│    Interactive Bounding Boxes ]             │                                               │
│                                             │ Phone Number                                  │
│    ┌───────────────────────────┐            │ [ 9876543210                 ] [ ✓ 98% CONF ] │
│    │ Patient: Ravi Kumar       │            │                                               │
│    │ Phone: 9876543210         │            │ Age / Gender                                  │
│    │ Rx: Amoxicillin 500mg     │            │ [ 38         ]  [ Male      ▼] [ ✓ 95% CONF ] │
│    │ Diag: Acute Pulpitis 16   │            │                                               │
│    └───────────────────────────┘            │ Diagnosis                                     │
│                                             │ [ Acute Pulpitis 16          ] [ ⚠ 82% CONF ] │
│                                             │                                               │
│                                             │ Procedures Performed                          │
│                                             │ [ Root Canal Treatment (16)  ] [ ⚠ 78% CONF ] │
│                                             │                                               │
│                                             │ Prescriptions                                 │
│                                             │ [ Amoxicillin 500mg TDS 5d   ] [ ⚠ 74% CONF ] │
├─────────────────────────────────────────────┴───────────────────────────────────────────────┤
│ ACTION BAR:                                                                                 │
│ [ Space ] Approve & Next    [ E ] Edit Values    [ R ] Reject / Mark Unreadable   [ Esc ] Skip│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Batch Processing Architecture

Processing 10,000 to 100,000 records must never execute inside an HTTP request-response cycle. DentalCore utilizes an asynchronous stage-based state machine:

```
[ BATCH STATUS STATE MACHINE ]

   UPLOADED
      │
      ▼
   VALIDATING  ─────────►  FAILED (Invalid format, corrupt zip)
      │
      ▼
   PARSING
      │
      ▼
   OCR_PROCESSING  (Chunked concurrency: 4 workers)
      │
      ▼
   AI_EXTRACTING
      │
      ▼
   AWAITING_REVIEW  (Pause point for human verification)
      │
      ▼
   COMMITTING  (Atomic PostgreSQL chunk inserts)
      │
      ▼
   COMPLETED
```

---

## 14. PostgreSQL-Backed Migration Queue vs Redis

DentalCore's existing communication module proves that PostgreSQL-backed queues using atomic job reservation (`SELECT ... FOR UPDATE SKIP LOCKED`) provide crash safety, zero extra infrastructure footprint, and transaction isolation.

### Architectural Evaluation

| Evaluation Metric | PostgreSQL-Backed Job Table | Redis + BullMQ |
| :--- | :--- | :--- |
| **Infrastructure Overhead** | **Zero additional services**. Uses existing Render PostgreSQL. | Requires provisioning, configuring, and monitoring Redis instances. |
| **Transaction Atomicity** | **Complete**. Job state transitions, patient record creation, and document associations commit in the same ACID transaction. | Two-phase operations (Redis state vs PostgreSQL commit) can desync on server crash. |
| **Crash Recovery** | Built-in recovery sweep (identifies stale `PROCESSING` jobs on startup). | Requires BullMQ stalled-job timers. |
| **Throughput Suitability** | Handles **100–300 OCR jobs/minute** comfortably, exceeding typical clinic intake requirements. | Suitable for 10,000+ jobs/second (unnecessary for clinic batch migration). |
| **Verdict** | **RECOMMENDED**: Extend existing PostgreSQL queue pattern. | **NOT JUSTIFIED** at current clinic scale. |

### Proposed Queue Schema Concept
```sql
CREATE TABLE "MigrationJob" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batchId" UUID NOT NULL,
  "recordIndex" INT NOT NULL,
  "stage" VARCHAR(32) NOT NULL, -- 'OCR' | 'EXTRACTION' | 'MATCHING' | 'COMMIT'
  "status" VARCHAR(32) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  "payload" JSONB NOT NULL,
  "attempts" INT DEFAULT 0,
  "lastError" TEXT,
  "lockedAt" TIMESTAMP,
  "lockedBy" VARCHAR(64),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX "idx_migration_job_claim" ON "MigrationJob" ("stage", "status") WHERE "status" = 'QUEUED';
```

---

## 15. Security, Authorization & Privacy Safeguards

1. **Role-Based Access Control (RBAC)**:
   - Only `Head Doctor` and `Admin` users can initiate, view, edit, or commit migration batches.
   - Receptionists and Duty Doctors receive `403 Forbidden` on all migration endpoints.
2. **Encrypted Storage at Rest**:
   - Uploaded source documents (PDFs, images) are stored with AES-256 server-side encryption.
3. **No Patient PII in Logs**:
   - Backend logger automatically strips patient names, phones, and medical notes from application logs. Only job UUIDs and processing statistics are recorded.
4. **Isolated Temporary File Lifecycle**:
   - Raw uploads stored in secure temp directories (`/tmp/dentalcore-migration/`) with strict `0600` permissions. Files are unlinked immediately after ingestion or moved to permanent document archives.

---

## 16. Migration Audit Trail

For legal and operational accountability, every imported record carries permanent provenance metadata:

```json
{
  "migrationAudit": {
    "batchId": "b8a912e4-99a1-4d92-94b1-e23901bfa821",
    "sourceFilename": "march_2026_op_cards.pdf",
    "pageNumber": 14,
    "importedByStaffId": "staff_head_doctor_01",
    "importedAt": "2026-09-14T10:45:00Z",
    "sourceSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "confidenceScore": 0.88,
    "reviewedAndEditedFields": ["phoneNumber", "toothNumber"]
  }
}
```

---

## 17. Error & Exception Reporting

Every batch migration produces a downloadable, machine-readable, and human-readable audit package:

1. **Summary Dashboard**: Total Uploaded, Processed, Automatically Imported, Manually Verified, and Rejected records.
2. **Rejection CSV Export**: Downloadable spreadsheet containing all failed rows with exact line numbers and human-readable error reasons (e.g., `Line 482: Invalid phone number '98765' (must be 10 digits)`).
3. **Duplicate Collision Report**: Identifies records flagged for duplicate resolution with side-by-side comparisons of existing vs incoming data.

---

## 18. Real-World Scenario Analyses

| Scenario | Input Profile | Expected Behavioral Pipeline |
| :--- | :--- | :--- |
| **A: 10,000 Patients in Excel** | Single `.xlsx` with demographic columns. | Streamed via `exceljs` reader in 500-row chunks. Previews first 10 rows for column mapping. Phone deduplication executes against PostgreSQL index. ~10,000 records imported in **under 45 seconds**. |
| **B: 50,000 Patients in CSV** | Large CSV export from old legacy system. | Multi-part upload streamed to disk. Background batch job processes row validation. Memory capped at <100 MB RAM. Progress bar reports percentage to client via polling endpoint. |
| **C: 5,000 Scanned PDF Files** | Multi-page scanned PDF charts in a `.zip` archive. | Archive unzipped in worker scratch space. Document hash computed. PDF pages rasterized to 300 DPI PNGs. OCR worker pool extracts demographics. Low-confidence fields enter **Human Review Queue**. Original PDFs archived in `PatientDocument`. |
| **D: 10,000 Handwritten Case Sheets** | Photographed physical case history paper cards. | Image contrast enhancement + deskew applied. Handwriting recognition produces raw text tokens. Mandatory rule: **Zero automated clinical insertion**. Clinical notes mapped as historical narrative. Human verification required before record commits. |
| **E: Mixed Excel + Scanned Docs** | Excel demographic sheet + folder of scanned patient files. | Phase 1 imports Excel master demographics. Phase 2 ingests scans, matches patient via Phone/OP Number, and attaches document directly to existing patient profile. |
| **F: Old Software Lacks Clinical History** | CSV with demographics only; clinical data missing. | Demographics imported cleanly into `Patient`. Clinical cards leave patient with clean slate ready for active visit encounters. |
| **G: Multi-Page PDF per Patient** | Individual PDF files named `OP_1024.pdf`, `OP_1025.pdf`. | Parser extracts OP Number from filename as fallback identifier. Pages collated into a single `PatientDocument` record linked to patient. |
| **H: Cross-File Patient Duplication** | Same patient appears in multiple uploaded files. | First occurrence creates patient; subsequent occurrences match on phone number and attach additional notes/documents rather than spawning duplicate profiles. |
| **I: OCR Hallucination / Corruption** | Ink smudge on scan causes OCR to read phone as letters. | Validation schema catches invalid phone format. Confidence score drops to 0.0. Entire record routed to operator review desk. |
| **J: Server Restart During Migration** | Power cut or Render restart during 50,000-row import. | Startup recovery sweep identifies jobs in `PROCESSING` status. Uncommitted database transactions roll back automatically. Background worker resumes from the last committed chunk without duplication. |

---

## 19. Phased Implementation Roadmap

To maintain clinic stability and minimize risk, migration capabilities should roll out across five distinct engineering phases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Structured Patient Migration (Excel & CSV)                         │
│ - Streaming parser for .xlsx and .csv                                       │
│ - Column mapping & normalization engine                                      │
│ - Conservative phone deduplication                                         │
│ - Batch progress tracking & error CSV generation                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Patient Document Archive Foundation                                │
│ - Creation of PatientDocument model and encrypted file storage              │
│ - Manual document attachment in Patient Profile                             │
│ - Direct PDF text extraction for searchable digital documents               │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Optical Character Recognition (OCR) Ingestion                      │
│ - Image preprocessing (deskew, binarization, blur metrics)                  │
│ - Provider-independent OCR adapter architecture                             │
│ - Geometry-aware bounding box tokenization                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Human Review & Verification Workspace                              │
│ - Visual side-by-side document review desk                                  │
│ - Confidence-level color highlighting                                       │
│ - Keyboard shortcuts for high-speed operator validation                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: AI Clinical Extraction & Shorthand Parsing                         │
│ - Medical NLP prompt pipeline for dental shorthand (FDI tooth, RCT, Ext)    │
│ - Extraction of draft consultation notes & treatment roadmap                │
│ - Strict non-binding draft boundaries                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 20. Business & Operational Decision Matrix

Not all migration tasks should be automated by software. A realistic clinic product must classify migration workloads into three operational tiers:

```
                               MIGRATION TIERS
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
[ TIER 1: FULLY AUTOMATED ]    [ TIER 2: SEMI-AUTOMATED ]    [ TIER 3: ASSISTED SERVICE ]
  - Excel & CSV Patients         - Digital Searchable PDFs     - Severe Handwritten Notes
  - Standard EMR Exports         - Scanned Typed Documents     - Physical Paper Case Sheets
  - High-res printed cards       - Moderate-quality Scans      - Damaged or Torn Records
```

1. **Tier 1: Self-Service Automated (Clinic Self-Serve)**
   - Clinics upload clean CSV or Excel files directly through the DentalCore UI. Software handles validation, deduplication, and streaming import with zero manual intervention required.
2. **Tier 2: Semi-Automated with In-App Verification (Doctor / Receptionist Review)**
   - Scanned typed cards and digital PDFs are processed by the OCR engine. Clinic staff spends 10–15 seconds per record confirming green/yellow fields on the verification desk.
3. **Tier 3: Professional Assisted Migration (DentalCore Concierge Onboarding)**
   - Clinics with thousands of physical paper files, degraded handwritten cards, or unindexed records utilize an offline scanning and professional data-entry onboarding service before importing structured outputs into DentalCore.

---

## 21. Summary & Recommended Next Steps

1. **Review & Architectural Approval**: Review this comprehensive design document.
2. **Phase 1 Initiation**: When approved, implementation should begin strictly with **Phase 1 (Structured Excel & CSV Migration)**, establishing the core streaming worker, duplicate matching rules, and error reporting without introducing OCR dependencies prematurely.
3. **Medicolegal Safety**: The strict boundary ensuring that clinical data from OCR/AI is never silently committed without human verification protects both the clinic and the patient.
