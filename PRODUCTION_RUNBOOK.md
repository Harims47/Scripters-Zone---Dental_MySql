# DentalCore — Production Operations Runbook & Incident Response Guide

This runbook establishes standard operating procedures for deploying, maintaining, monitoring, and debugging the DentalCore Clinical Management System in production.

---

## 1. System Architecture & Topology

- **Web Server / Reverse Proxy:** Nginx (SSL termination, rate limiting, static frontend hosting, passes/generates `X-Request-ID`).
- **Application Server:** Node.js / Express (TypeScript runtime), port `3001`.
- **Frontend Client:** React / Vite Single Page Application (SPA), served as static assets.
- **Authoritative Database:** Dedicated MySQL 8.0 instance (Docker or managed Linux service), port `3306`.
- **Database Access Layer:** Prisma ORM 7.x with MariaDB adapter (`@prisma/adapter-mariadb`).

---

## 2. Database Least-Privilege Architecture

DentalCore strictly separates application runtime execution from deployment-time schema migrations. Never use the MySQL `root` user in production application environments.

### Database Users & Credentials

| User | Purpose | Granted Privileges | Scope | Used By |
| :--- | :--- | :--- | :--- | :--- |
| `dental_app` | Application Runtime | `SELECT, INSERT, UPDATE, DELETE` | `dentalcore.*` | Express API (`DATABASE_URL`) |
| `dental_migration` | Deployments & Migrations | `CREATE, DROP, ALTER, INDEX, REFERENCES` + DML | `dentalcore.*` | CI/CD & Deploy Scripts (`MIGRATION_DATABASE_URL`) |

### Provisioning Command (DBA / Initial Setup)
Execute the vetted setup script:
```bash
mysql -u root -p < server/scripts/production_mysql_setup.sql
```

### Prisma Configuration
- **Runtime (`server/.env`):**
  ```env
  DATABASE_URL="mysql://dental_app:<STRONG_APP_PASSWORD>@127.0.0.1:3306/dentalcore?sslmode=prefer"
  ```
- **Migrations / Deployment:**
  ```env
  DATABASE_URL="mysql://dental_migration:<STRONG_MIGRATION_PASSWORD>@127.0.0.1:3306/dentalcore?sslmode=prefer"
  ```

---

## 3. Starting, Stopping, and Restarting Services

### Systemd Service Management (Production VPS)

```bash
# Check service status
sudo systemctl status dentalcore-backend
sudo systemctl status nginx
sudo systemctl status mysql

# Restart backend service gracefully
sudo systemctl restart dentalcore-backend

# View systemd service journal logs
sudo journalctl -u dentalcore-backend -n 100 -f
```

### Graceful Shutdown
The Express backend handles `SIGTERM` and `SIGINT` signals:
1. Stops accepting new inbound HTTP requests.
2. Waits for active in-flight requests and database transactions to finish (timeout: 10s).
3. Disconnects Prisma client pool.
4. Flushes and closes Winston log file streams before exiting `0`.

---

## 4. Production Observability & Logging Architecture

DentalCore uses structured JSON logging via Winston with automatic daily rotation, compression, and strict PII sanitization.

### Log Storage Locations

- **Production VPS:** `/var/log/dentalcore/` (configurable via `LOG_DIR` environment variable).
  *Note:* Must be owned by the service user (e.g., `chown -R dentalapp:dentalapp /var/log/dentalcore`).
- **Local Fallback / Development:** `server/logs/`

### File Rotation & Retention Policy
- **Rotation Frequency:** Daily at midnight (`app-YYYY-MM-DD.log`, `error-YYYY-MM-DD.log`).
- **Max File Size:** `20 MB` per file.
- **Retention Period:** `14 days`. Files older than 14 days are automatically purged.
- **Compression:** Historical logs are automatically compressed with gzip (`.gz`).
- **Persistence Guarantee:** Server restarts, service crashes, and deployments **never** truncate or delete historical logs.

### PII Sanitization Guarantee
The Winston logging pipeline applies an automated recursive redaction filter (`redactFormat`). The following fields are masked with `[REDACTED]` prior to serialization:
- `password`, `token`, `authorization`, `cookie`, `secret`, `jwt`
- `phone`, `mobile`, `email`
- `medicalHistory`, `clinicalNotes`, `diagnosis`, `prescription`, `notes`
- Raw incoming request bodies (`req.body`) are **never** logged globally.

---

## 5. End-to-End Request ID Tracing

Every HTTP interaction across the system is correlated via a single authoritative `X-Request-ID`.

```
Browser (UI) ──[X-Request-ID: req_abc123]──> Nginx ──> Express API ──> Winston Logs / DB Audit
      ▲                                                      │
      └──────────────── HTTP 500 Response ───────────────────┘
               { "error": "...", "requestId": "req_abc123" }
```

### Request ID Lifecycle Rules:
1. If Nginx or an upstream gateway injects `X-Request-ID`, Express accepts and reuses it (provided it matches `^[a-zA-Z0-9_\-]{8,64}$`).
2. If absent or invalid, Express generates a cryptographically random identifier: `req_<timestamp>_<randomhex>`.
3. The server sets `res.setHeader('X-Request-ID', requestId)` on all outgoing responses.
4. If an unhandled exception or 500 error occurs:
   - The backend includes `{ "error": "Internal server error", "requestId": "..." }` in the response body.
   - The frontend `ErrorBoundary` and API notification layer surfaces the Request ID directly to the user.

---

## 6. Incident Triage Protocol: "What to Ask the Clinic"

When clinic staff (Doctor, Receptionist, Dispenser) report an unexpected system error, follow this checklist immediately:

### Step 1: Information Gathering from User
Ask the reporter for:
1. **Request ID:** Displayed on the error dialog/toast (e.g., `req_1726756800000_a1b2c3d4`).
2. **User Role & Name:** (e.g., "Receptionist Mary").
3. **Approximate Time of Incident:** (e.g., "around 14:15").
4. **Patient Identifier / MRN:** (e.g., "Patient MRN-2026-0042").
5. **Exact Action Attempted:** (e.g., "Clicked 'Settle Payment' with cash amount 500").

### Step 2: Correlating Logs in Production
SSH into the production server and run:

```bash
# 1. Search for the Request ID across current and compressed logs
grep "req_1726756800000_a1b2c3d4" /var/log/dentalcore/app-*.log

# If the incident occurred on a previous day (search compressed archives):
zgrep "req_1726756800000_a1b2c3d4" /var/log/dentalcore/*.log.gz

# 2. Extract error stack trace and metadata
grep -A 10 "req_1726756800000_a1b2c3d4" /var/log/dentalcore/error-*.log
```

### Step 3: Distinguishing Technical Logs vs Business Audit Logs
- **Technical Log (`/var/log/dentalcore/`):** Records operational errors (e.g., database connection timeout, unhandled rejection, syntax error). If a mutation fails with a 500, a technical error log is emitted.
- **Business Audit Log (`AuditLog` MySQL table):** Records authoritative financial and medical state changes (e.g., `PAYMENT_RECORDED`, `MEDICINE_DISPENSED`).
  - **Golden Invariant:** If a payment transaction fails and rolls back, NO `PAYMENT_RECORDED` event is written to `AuditLog`. Only successful commits create an `AuditLog` row.
  - To inspect financial audit history in MySQL:
    ```sql
    SELECT * FROM AuditLog 
    WHERE entity = 'Payment' 
    ORDER BY createdAt DESC LIMIT 20;
    ```

---

## 7. Health Checks & Monitoring Endpoints

DentalCore provides decoupled liveness and readiness endpoints for automated uptime monitors (e.g., Datadog, UptimeKuma, Kubernetes, AWS ALB):

| Endpoint | Method | Expected HTTP Code | Validation Performed | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| `/api/health/live` | `GET` | `200 OK` | Process is running and accepting event loop tasks. | Process supervisor liveness probe. |
| `/api/health/ready` | `GET` | `200 OK` (or `503`) | Active connection test to MySQL (`SELECT 1`). | Traffic load balancer readiness probe. |

### Diagnostic Curl Commands:
```bash
# Check process liveness
curl -I http://localhost:3001/api/health/live

# Check database readiness
curl -i http://localhost:3001/api/health/ready
```

---

## 8. Database Backup & Disaster Recovery (DR)

### Backup Procedure
Database dumps are executed without exposing credentials in the process argument list (`ps aux`).

```bash
# Run automated backup
npm run db:backup
# or directly via script:
npx tsx server/scripts/backup.ts
```
- Output location: `server/backups/backup_YYYY-MM-DD_HH-mm-ss.sql`
- Method: Uses `MYSQL_PWD` environment variable passed directly to `mysqldump`.

### Automated Disaster Recovery & Restore Verification
Never rely on unverified database backups. DentalCore includes an automated test restore suite that recreates a clean sandbox database, executes the full SQL import, and performs row-count + smoke read validations.

```bash
# Execute automated disaster recovery test
npx tsx server/scripts/restore.ts <path_to_backup_sql>
```

**Verification Steps Executed by `restore.ts`:**
1. Drops and recreates `dentalcore_restore_test` sandbox database.
2. Streams SQL dump into sandbox instance via authenticated pipe.
3. Compares row counts between production and restored databases across core models:
   - `User`, `Patient`, `Visit`, `QueueEntry`, `Consultation`, `Payment`, `Medicine`, `InventoryTransaction`.
4. Executes live smoke reads:
   - `SELECT 1` connectivity.
   - Latest User query.
   - Latest Patient query.
   - Latest Visit status verification.
   - Latest Payment sum verification.

---

## 9. Security Policies & Hardening Summary

1. **CSRF & Origin Protection:** All state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid `Origin` or `Referer` matching trusted frontend origins. Requests originating from browser sessions with missing or mismatched origins are rejected with `403 Forbidden`.
2. **Security HTTP Headers (Helmet):**
   - `X-Frame-Options: SAMEORIGIN` (enables PDF bill and prescription printing inside modal iframe while blocking external clickjacking).
   - `X-Content-Type-Options: nosniff`.
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (production).
   - Content Security Policy (CSP) tailored for camera photo capture (`blob:`, `data:`) and PDF preview generation.
3. **Payload Limits:**
   - Global JSON limit: `2 MB` (prevents memory exhaustion DoS).
   - Webcam patient photo upload endpoint (`/api/patients`): `15 MB`.
4. **Rate Limiting:**
   - Financial mutations (`/api/payments`): 30 requests / minute.
   - Data exports (`/api/reports/export`): 10 requests / minute.
   - External notifications (`/api/notifications/send`): 20 requests / minute.
5. **Fail-Closed Secrets:**
   - `JWT_SECRET` must be set in production; missing secret aborts server startup (`process.exit(1)`).
   - Webhook verification fails closed if `COMMUNICATION_WEBHOOK_SECRET` is unset in production.
