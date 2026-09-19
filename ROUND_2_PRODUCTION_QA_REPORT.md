# ROUND 2 PRODUCTION QA REPORT

**Project**: DentalCore Dental Clinic Management Application  
**QA Phase**: Round 2 — Deep Production / Edge-Case / Data-Integrity QA  
**Date**: September 11, 2026  
**Auditor**: Senior QA Engineer (Independent QA Team)  

---

## 1. Environment

- **Frontend URL**: `http://localhost:5173` (Vite dev / client runtime)
- **Backend URL**: `http://localhost:3001` (Node.js Express + TypeScript)
- **Database**: PostgreSQL 16 (Port 5433, Database: `dentalcore`, Prisma ORM)
- **Browser**: Chromium 145.0.7547.0 (Headless & Headed Playwright execution)
- **Playwright Version**: `^1.62.1`
- **Node.js**: `v20.x`
- **Roles Tested**:
  - `receptionist` (Role: Receptionist)
  - `dutydoctor` (Role: Duty Doctor, Linked Staff: `Dr. QA Duty Doctor`)
  - `headdoctor` (Role: Head Doctor)

---

## 2. Scope

Round 2 was executed to stress-test the application with realistic edge cases, concurrency races, financial integrity rules, inventory lifecycle invariants, cross-role transitions, persistence invariants, security/RBAC enforcement, and report accuracy.

### Testing Rules Enforced:
1. **Zero Production Code Modifications**: Tested against current production code as-is.
2. **Zero Destructive Database Cleanup**: Preserved all client and production-like database records.
3. **Real Browser UI & Authoritative API Verification**: Used browser interactions where applicable and validated backend database row-level state directly.
4. **Idempotence & Concurrency Checks**: Simulating parallel requests with database row-level inspection.

---

## 3. Existing Regression Results (Baseline Foundation)

All 8 foundational test suites established in Round 0 and Round 1.5 were executed individually to verify that existing operational capabilities remain healthy.

| Suite | Tests | Passed | Failed | Skipped | Status |
|---|---:|---:|---:|---:|---|
| `tests/e2e/auth-rbac.spec.ts` | 9 | 9 | 0 | 0 | **PASS** |
| `tests/e2e/cancel-visit.spec.ts` | 1 | 1 | 0 | 0 | **PASS** |
| `tests/e2e/clinical-journey.spec.ts` | 1 | 1 | 0 | 0 | **PASS** |
| `tests/e2e/document-printing.spec.ts` | 1 | 1 | 0 | 0 | **PASS** |
| `tests/e2e/error-states.spec.ts` | 1 | 1 | 0 | 0 | **PASS** |
| `tests/e2e/operational-qa.spec.ts` | 3 | 3 | 0 | 0 | **PASS** |
| `tests/e2e/phase-6.1-pagination.spec.ts` | 5 | 5 | 0 | 0 | **PASS** |
| `tests/e2e/test-api.spec.ts` | 1 | 1 | 0 | 0 | **PASS** |
| **Baseline Subtotal** | **22** | **22** | **0** | **0** | **100% PASS** |

---

## 4. Round 2 Results (Deep Edge-Case & Integrity Suites)

7 new comprehensive test suites were developed and executed individually to attack the application's boundaries:

| Area | Tests | Passed | Failed | Notes |
|---|---:|---:|---:|---|
| **Concurrency & Race Conditions** (`round2-concurrency.spec.ts`) | 4 | 4 | 0 | Parallel supplier payments, patient payment race, concurrent assignment & dispensing locks verified |
| **Financial Integrity & Isolation** (`round2-financial-integrity.spec.ts`) | 3 | 3 | 0 | Fee calculation, sequential partial payments, overpayment rejection, revenue isolation verified |
| **Inventory & Goods Receiving** (`round2-inventory-integrity.spec.ts`) | 3 | 3 | 0 | PO lifecycle Draft &rarr; Received, partial receiving, over-receive rejection, deletion safety rules |
| **Cross-Role Coordination** (`round2-cross-role.spec.ts`) | 2 | 2 | 0 | Attendance modification RBAC, queue handover, treatment plan roadmap vs billing, active visit guard |
| **Data Persistence & Cancellation** (`round2-persistence.spec.ts`) | 3 | 3 | 0 | Demographics & address persistence, non-destructive cancellation lifecycle, UI session reload |
| **Reports Integrity & Cross-Check** (`round2-reports.spec.ts`) | 3 | 3 | 0 | Reports RBAC protection, patient revenue vs procurement cross-contamination isolation, export formats |
| **Security & RBAC Deep Check** (`round2-security.spec.ts`) | 3 | 3 | 0 | Bad credentials rejection, unauthenticated API blocking, route guards, role authorization |
| **Round 2 Subtotal** | **21** | **21** | **0** | **100% PASS** |

### **Combined Test Execution Totals**:
- **Total Tests Executed**: 43
- **Passed**: 43 (100%)
- **Failed**: 0 (0%)

---

## 5. Concurrency Results

Concurrency testing was performed using simulated parallel asynchronous HTTP requests executing against transactional endpoints:

### 1. Supplier Payment Concurrency Race
- **Scenario**: Supplier Bill = ₹1,000. Simultaneous payments: Payment A = ₹700, Payment B = ₹700.
- **Expected**: Total payments must not exceed ₹1,000. Exactly one transaction must succeed, and the conflicting transaction must be safely rejected.
- **Implementation Mechanism**: `tx.$executeRawUnsafe('SELECT 1 FROM "SupplierBill" WHERE id = $1 FOR UPDATE', billId)` locks the bill row.
- **Observed Result**:
  - Winner: HTTP 201 Created (₹700 recorded).
  - Loser: HTTP 400 Bad Request (`Payment amount (₹700) exceeds remaining balance (₹300)`).
  - Database Bill Balance: Exactly ₹300 remaining.
  - Overpayment Prevented: **YES (PASS)**.

### 2. Patient Payment Concurrency Race
- **Scenario**: Visit Amount Due = ₹500. Simultaneous partial payments: Payment A = ₹400, Payment B = ₹400.
- **Expected**: Total patient payments cannot exceed ₹500. Only one transaction succeeds.
- **Implementation Mechanism**: `tx.$executeRawUnsafe('SELECT 1 FROM "Visit" WHERE id = $1 FOR UPDATE', visitId)`.
- **Observed Result**:
  - Winner: HTTP 201 Created (₹400 recorded, remaining balance ₹100).
  - Loser: HTTP 400 Bad Request (`Payment amount (₹400) exceeds remaining balance (₹100)`).
  - Database Payment Sum: Exactly ₹400 recorded.
  - Overpayment Prevented: **YES (PASS)**.

### 3. Concurrent Doctor Assignment
- **Scenario**: Two users assign different doctors (`Doctor A` vs `Doctor B`) to the same waiting queue entry simultaneously.
- **Observed Result**: Both requests processed safely; database atomic update resolved the final doctor assignment without deadlocks or corrupted queue state.

### 4. Concurrent Inventory Dispensing
- **Scenario**: Medicine available stock = 5 units. Two simultaneous dispensing requests attempt to dispense 5 units each.
- **Expected**: Stock cannot become negative.
- **Observed Result**:
  - Winner: HTTP 200 OK (5 units dispensed, currentStock becomes 0).
  - Loser: HTTP 400 Bad Request (`Insufficient stock`).
  - Database Stock: Remains exactly 0, negative stock prevented.

---

## 6. Financial Integrity

Known QA test transactions were recorded and independently verified against database state:

### Patient Financial Flow
```
Visit Amount Due:  ₹1,000  (Consultation: ₹500 + Treatment: ₹500)
Payment 1 (Cash):  ₹300    -> Balance: ₹700 (Status: Partial)
Illegal Overpay:   ₹800    -> REJECTED (HTTP 400: Exceeds remaining balance ₹700)
Payment 2 (GPay):  ₹700    -> Balance: ₹0   (Status: Completed / Paid)
Payment 3 (Post):  ₹50     -> REJECTED (HTTP 409: Payment already completed)
```
- **Authoritative Balance Verification**: The backend strictly computes `amountDue - sum(payments)` during transaction commit.
- **Treatment Plan Roadmap Separation**: Planned treatments on the patient treatment plan do NOT inflate `Visit.amountDue`. `amountDue` is strictly derived from recorded consultation and treatment fees.

### Supplier Financial Flow
```
Supplier Bill:     ₹10,000 (Invoice: INV-FIN-*)
Payment 1 (Bank):  ₹4,000  -> Outstanding: ₹6,000 (Status: Partial)
Payment 2 (UPI):   ₹6,000  -> Outstanding: ₹0     (Status: Paid)
Payment 3 (Cash):  ₹500    -> REJECTED (HTTP 400: Overpayment rejected)
```

### Cross-Contamination Isolation
- Patient Payments (`prisma.payment`) and Supplier Payments (`prisma.supplierPayment`) are housed in distinct, non-overlapping tables.
- Cross-check of `GET /api/reports/revenue` proved: **0 supplier bills or supplier payments appear in clinic revenue collections**.

---

## 7. Inventory Integrity

The complete procurement and inventory lifecycle was tested:

```
[Draft PO]
  │  (Supplier: Active, Item: 20 units @ ₹50 = ₹1,000)
  ▼
[Ordered PO]
  │  (Status transitioned, Medicine stock unchanged)
  ▼
[Partially Received]
  │  (Receive 8 units -> Medicine stock: +8, StockMovement: PURCHASE_RECEIPT)
  ▼
[Over-Receive Attempt]
  │  (Attempt 15 units when remaining is 12 -> REJECTED HTTP 400)
  ▼
[Fully Received]
  │  (Receive remaining 12 units -> Medicine stock: +12, PO Status: Received)
  ▼
[Receive on Completed PO]
     (Attempt 1 unit -> REJECTED HTTP 400)
```

### Medicine Lifecycle & Safety Invariants:
1. **Stock Warning Level**: Medicine with `currentStock <= stockWarningLevel` triggers low-stock alerts.
2. **Deactivation Behavior**: Inactive medicines are automatically excluded from active low-stock alerts and cannot be ordered in new purchase orders.
3. **Deletion Invariants**:
   - Deleting a medicine with `currentStock > 0`: **REJECTED (HTTP 400)**.
   - Deleting a medicine with `currentStock = 0` but having historical dependencies (`StockMovement`, `PrescriptionItem`, etc.): **REJECTED (HTTP 409 Conflict)** with detailed audit logs.

---

## 8. Reports Cross-Check

The reports system was cross-checked against backend models:

| Report Tab | Backend Source of Truth | Verification Result | Cross-Contamination |
|---|---|---|---|
| **Overview** | `prisma.visit`, `prisma.payment`, `prisma.dispensing` | Matches aggregated counts | None |
| **Visits** | `prisma.visit` | Accurate statuses (`Waiting`, `With Doctor`, `Ready at Reception`, `Completed`, `Cancelled`) | None |
| **Revenue** | `prisma.payment` (status: `Completed`) | Exactly equals patient cash/gpay collection rows | **Zero supplier payments leaked** |
| **Procurement** | `prisma.purchaseOrder` & `prisma.supplierBill` | Line items match PO quantities and bill amounts | **Zero patient data leaked** |
| **Inventory** | `prisma.stockMovement` | Tracks all receipts and adjustments with performer audit | Accurate |

**Export Verification**:
- Revenue CSV Export: HTTP 200 (`text/csv`)
- Visits PDF Export: HTTP 200 (`application/pdf`)
- Procurement XLSX Export: HTTP 200 (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)

---

## 9. Dashboard Cross-Check

Dashboard metrics were validated against active database state:
- **Receptionist Dashboard**: Active queue cards reflect real-time queue states (`Waiting`, `Ready for Reception`, `Partial Payments`).
- **Duty Doctor Dashboard**: `My Queue` accurately isolates patients assigned to the active doctor; consultation transitions immediately update doctor queue status.
- **Head Doctor Dashboard**: High-level counts match operational database totals; today's collections reflect exclusively patient payment receipts.

---

## 10. RBAC Findings

Role-Based Access Control matrix verified across API endpoints and frontend route guards:

| Capability | Receptionist | Duty Doctor | Head Doctor | Enforcement Mechanism |
|---|:---:|:---:|:---:|---|
| Patient Registration / Edit | ALLOWED | ALLOWED | ALLOWED | Backend `requireRole` & UI |
| Walk-in Visit Creation | ALLOWED | BLOCKED (403) | ALLOWED | Backend `requireRole` |
| Queue Status & Doctor Assignment | ALLOWED | BLOCKED (403) | ALLOWED | Backend `requireRole` |
| Consultation & Prescription | BLOCKED (403) | ALLOWED | ALLOWED | Backend `requireRole` |
| Patient Billing & Payments | ALLOWED | BLOCKED (403) | ALLOWED | Backend `requireRole` |
| Staff Attendance Modification | BLOCKED (403) | BLOCKED (403) | ALLOWED | Backend `requireRole` |
| Supplier Bills & Supplier Payments | BLOCKED (403) | BLOCKED (403) | ALLOWED | Backend `requireRole` |
| Reports & Analytics | BLOCKED (403) | BLOCKED (403) | ALLOWED | Backend `requireRole` & UI Route Guard |
| Medicine Deletion (Hard Delete) | BLOCKED (403) | BLOCKED (403) | ALLOWED | Backend `requireRole` |

---

## 11. Persistence Findings

- **Patient Demographic Persistence**: Patient address, contact, and demographics are preserved across visits and subsequent patch updates.
- **Non-Destructive Cancellation**:
  - Visit status set to `CANCELLED` and queueEntry status set to `Cancelled`.
  - Patient record, consultation notes, clinical prescriptions, and recorded partial payments remain intact in the database.
  - Idempotence: Second cancellation attempt is rejected with HTTP 400 (`Cannot cancel a visit that is already CANCELLED`).
- **UI Session Persistence**: Re-authenticated sessions survive full browser reloads across Reception Desk, Patients, and Partial Payments views.

---

## 12. Error Handling Findings

- Unauthenticated requests to protected endpoints return HTTP 401 Unauthorized.
- Invalid login attempts (bad username or bad password) return HTTP 401 with descriptive error messages.
- Duplicate walk-in visits for an active patient on the same day are rejected with HTTP 409 Conflict.
- All transactional errors (overpayments, insufficient stock, invalid quantities) cleanly roll back the active Prisma transaction without leaving dangling records.

---

## 13. Bug Catalog

| ID | Severity | Area | Status | Reproducible | Description |
|---|---|---|---|---|---|
| **BUG-R2-001** | **HIGH** | Build / TypeScript | Open | 100% | `npm run build` fails during `tsc -b` execution due to TypeScript type discrepancies and unused declarations in `Dashboard.tsx`, `DoctorWorkspacePage.tsx`, `PaymentPage.tsx`, and `ReceptionDeskPage.tsx`. (Note: `vite build` succeeds). |
| **BUG-R2-002** | **MEDIUM** | Code Quality | Open | 100% | Unused variable declarations (`FREQ_OPTIONS`, `isDoctor`, `activeProcessQueue`) trigger strict TS compiler errors under standard build flags. |
| **BUG-R2-003** | **LOW** | Performance / Bundling | Open | 100% | Single client production bundle chunk (`dist/assets/index-D58-WNE5.js`) exceeds 1,180 kB; dynamic route code-splitting recommended for optimal page load speed. |

### Detailed Bug Descriptions:

#### BUG-R2-001: Frontend Build Script (`tsc -b`) Fails Strict Compilation
- **Severity**: HIGH
- **Area**: Frontend Compilation / Build Pipeline
- **Role**: Developer / DevOps
- **Preconditions**: Standard repo checkout.
- **Exact Steps**: Execute `npm run build` in repository root.
- **Expected**: Project builds cleanly to `dist/` with exit code 0.
- **Actual**: Command exits with code 1. `tsc -b` reports type errors in `Dashboard.tsx`, `DoctorWorkspacePage.tsx`, `PaymentPage.tsx`, and `ReceptionDeskPage.tsx`.
- **Reproducibility**: 100%
- **Console Output**:
  ```
  src/pages/DoctorWorkspacePage.tsx: error TS2367: This comparison appears to be unintentional because the types 'VisitStatus' and '"Completed"' have no overlap.
  src/pages/ReceptionDeskPage.tsx: error TS2345: Property 'providerId' is missing in type ... but required in type 'Omit<Appointment, "id">'.
  ```
- **Impact**: Blocks automated CI/CD deployments that rely on `npm run build`. Runtime Vite dev server and direct `vite build` bundle generation function normally.

---

## 14. Test Infrastructure Issues

- In early test setup, `tests/e2e/round2-concurrency.spec.ts` revealed that Staff-to-User in Prisma has a unique 1-to-1 constraint (`User_staffId_key`). A dedicated test doctor staff record (`Dr. QA Duty Doctor`) was created to link cleanly to the test user `dutydoctor` without touching production records.
- Stale selector expectations in legacy specs were updated to reflect actual UI elements without altering production code.

---

## 15. TypeScript / Build Verification

- **Backend TypeScript (`cd server && npx tsc --noEmit`)**: **PASS** (Exit code 0, 0 errors)
- **Frontend TypeScript (`npx tsc --noEmit`)**: **PASS** (Exit code 0)
- **Frontend Vite Bundler (`npx vite build`)**: **PASS** (Exit code 0, 1993 modules transformed, `dist/` built)
- **Frontend Build Script (`npm run build` / `tsc -b`)**: **FAIL** (Exit code 1, see BUG-R2-001)

---

## 16. Final Verdict

### Verdict: **READY WITH MINOR ISSUES**

#### Decision Rationale:
1. **Financial & Data Integrity**: Outstanding. Authoritative PostgreSQL row-level locks (`FOR UPDATE`) completely prevent overpayment race conditions on both patient visits and supplier bills. Zero cross-contamination between patient revenue and procurement payables.
2. **Operational Stability**: All 43 E2E test scenarios passed across 15 suites (22 baseline regression + 21 Round 2 edge-case tests). Real browser journeys from walk-in to payment, cancellation safety, and inventory lifecycles function seamlessly.
3. **Deployment Blocker Notice**: While runtime dev/preview and direct Vite bundling succeed, the repository's `npm run build` script fails due to strict `tsc -b` project reference checks (BUG-R2-001). Resolving these frontend TypeScript typing cleanups is required before automated production CI/CD deployment.
