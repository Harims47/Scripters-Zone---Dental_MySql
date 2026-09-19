# DENTALCORE PRODUCTION BACKUP & DISASTER RECOVERY RUNBOOK

This operational runbook provides strict, production-grade instructions for performing automated backups, manual safety dumps, and disaster recovery restorations for the DentalCore clinic database.

---

## 1. Operational Overview & Readiness Status

| Capability | Current Status | Notes / Location |
|---|---|---|
| **Backup Engine** | **IMPLEMENTED** | `server/scripts/backup.ts` using native PostgreSQL `pg_dump` |
| **One-Touch CLI Command** | **IMPLEMENTED** | `npm run db:backup` (run from `server/` directory) |
| **Live Dump Verification** | **VERIFIED** | Generated valid `130.43 KB` full SQL dump in `server/backups/` |
| **Automated Scheduler** | **REQUIRES SERVER OS CONFIG** | Administrator must register daily cron or Windows Task Scheduler |
| **Disaster Recovery Playbook** | **DOCUMENTED** | Step-by-step restoration and validation procedures below |

---

## 2. Backup Procedure

### What is Backed Up?
The backup script performs a full, self-contained SQL dump including:
- All DDL definitions (tables, primary keys, foreign keys, unique constraints, indices)
- Clinical records (patients, visits, appointments, consultations, treatment plans, prescriptions)
- Financial records (payments, receipts, partial payment balances, supplier bills, supplier payments)
- Operational data (inventory, stock movements, purchase orders, queue entries, staff attendance)
- System tables (users, roles, schema migration history)

### Manual Backup Command
From the `server` directory, execute:
```bash
npm run db:backup
```
Or directly via `tsx`:
```bash
npx tsx scripts/backup.ts
```

### Destination & File Naming
- Backups are written to: `server/backups/`
- Naming format: `dentalcore_backup_<YYYY-MM-DDTHH-mm-ss-sssZ>.sql`
- Example: `dentalcore_backup_2026-09-11T06-35-49-903Z.sql`

### Recommended Backup Strategy for Clinics
1. **Daily Operational Backup:** Run automatically every evening at 21:00 (after clinic closing hours).
2. **Pre-Upgrade Snapshot:** Run manually before applying any application update or running Prisma migrations.
3. **Retention Policy:**
   - Retain daily backups for **30 days** on the primary clinic server.
   - Mirror weekly Friday backups to an offsite encrypted drive or cloud storage (retained for **1 year** for medical compliance).

---

## 3. Configuring Automated Scheduling

Because DentalCore runs on local clinic infrastructure or dedicated hosting, the operating system's native scheduler must be configured to run the backup daily.

### Option A: Windows Server / Windows 11 (Task Scheduler)
1. Open **Task Scheduler** (`taskschd.msc`).
2. Click **Create Basic Task** -> Name: `DentalCore-Daily-Backup`.
3. Trigger: **Daily** at `21:00:00`.
4. Action: **Start a program**:
   - Program/script: `cmd.exe`
   - Arguments: `/c "cd /d D:\Scripters Zone\Dental\server && npm run db:backup >> backups\scheduler.log 2>&1"`
5. Select **Run whether user is logged on or not**.

### Option B: Linux / Docker (Crontab)
Add the following line to the `dentalcore` user crontab (`crontab -e`):
```bash
0 21 * * * cd /opt/dentalcore/server && npm run db:backup >> /var/log/dentalcore_backup.log 2>&1
```

---

## 4. Disaster Recovery Procedure

> [!CAUTION]
> **NEVER RESTORE OVER A LIVE, FUNCTIONING CLINIC DATABASE WITHOUT A PRE-RESTORE SAFETY BACKUP.**  
> Restoring will drop and recreate tables or overwrite existing records.

### Prerequisites
1. PostgreSQL service must be running and accessible.
2. The administrator must have database superuser or database owner credentials.
3. A verified `.sql` backup file from `server/backups/`.

### Step-by-Step Restoration
#### Step 1: Terminate active connections to the database
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'dentalcore' AND pid <> pg_backend_pid();
```

#### Step 2: Execute Restore Command
Using native `psql` command line tool:
```bash
psql -h 127.0.0.1 -p 5433 -U dental -d dentalcore -f "server/backups/dentalcore_backup_2026-09-11T06-35-49-903Z.sql"
```
*(Note: Replace host, port, user, and backup filename with your deployment values. Do not store passwords in scripts).*

#### Step 3: Verify Schema & Migration State
Verify that Prisma recognizes the restored state:
```bash
cd server
npx prisma migrate status
```
Expected output:
```text
Database schema is up to date!
```

#### Step 4: Verify Data Integrity Post-Restore
Run a verification check to ensure core counts match pre-incident metrics:
```bash
npx tsx -e "import { prisma } from './src/db'; async function v() { console.log('Patients:', await prisma.patient.count()); console.log('Visits:', await prisma.visit.count()); console.log('Payments:', await prisma.payment.count()); } v();"
```

#### Step 5: Restart Application Server
Restart the Node.js backend to re-establish clean connection pools:
```bash
npm run start
```
Verify clinic login, reception desk, and patient records in the browser.
