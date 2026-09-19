#!/usr/bin/env bash
# DentalCore Production Validated Backup & Mandatory Offsite Disaster Recovery Script
# Target location: /usr/local/bin/dentalcore-backup.sh
# Permissions: chmod 750 /usr/local/bin/dentalcore-backup.sh (owned by dentalbackup:dentalbackup)

set -euo pipefail

# 1. Source protected configuration
CONFIG_FILE="/etc/dentalcore/backup.env"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Missing backup configuration file: $CONFIG_FILE" >&2
    exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DUMP_FILE="${BACKUP_DIR}/dentalcore_backup_${TIMESTAMP}.sql"
GZ_FILE="${DUMP_FILE}.gz"
LOG_FILE="${LOG_DIR}/backup.log"

send_alert() {
    local severity="$1"
    local message="$2"
    echo "[$(date)] [$severity] $message" >> "$LOG_FILE"
    if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
        curl -s -X POST -H "Content-Type: application/json" \
          -d "{\"severity\":\"$severity\",\"service\":\"dentalcore-backup\",\"message\":\"$message\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
          "$ALERT_WEBHOOK_URL" || true
    fi
}

echo "[$(date)] Starting automated backup..." >> "$LOG_FILE"

# 2. Execute non-locking mysqldump via MYSQL_PWD (no CLI password exposure)
export MYSQL_PWD="$BACKUP_DB_PASSWORD"
if ! mysqldump -u "$BACKUP_DB_USER" -h "$BACKUP_DB_HOST" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "$BACKUP_DB_NAME" > "$DUMP_FILE"; then
    send_alert "CRITICAL" "Database dump failed during mysqldump execution."
    rm -f "$DUMP_FILE"
    exit 1
fi

# 3. Comprehensive Dump Integrity Validation
# A. Verify file existence and non-zero size
if [ ! -s "$DUMP_FILE" ]; then
    send_alert "CRITICAL" "Dump file is empty or missing."
    rm -f "$DUMP_FILE"
    exit 1
fi

# B. Verify dump completion footer
if ! tail -n 10 "$DUMP_FILE" | grep -q "Dump completed on"; then
    send_alert "CRITICAL" "Dump file is truncated or corrupted (missing completion marker)."
    rm -f "$DUMP_FILE"
    exit 1
fi

# C. Verify core schema DDL markers exist
for table in "Patient" "Visit" "User" "Payment" "AuditLog"; do
    if ! grep -q "CREATE TABLE \`$table\`" "$DUMP_FILE"; then
        send_alert "CRITICAL" "Dump validation failed: missing essential table marker for '$table'."
        rm -f "$DUMP_FILE"
        exit 1
    fi
done

# 4. Gzip Compression & Archive Validation
gzip -9 "$DUMP_FILE"
chmod 600 "$GZ_FILE"

if ! gzip -t "$GZ_FILE"; then
    send_alert "CRITICAL" "Gzip archive integrity check failed (corrupted archive)."
    exit 1
fi

FILE_SIZE=$(stat -c%s "$GZ_FILE")
echo "[$(date)] Local backup verified: $GZ_FILE ($FILE_SIZE bytes)" >> "$LOG_FILE"

# 5. Mandatory Offsite Cloud Replication (Fail-Closed)
if ! command -v rclone &> /dev/null; then
    send_alert "CRITICAL" "rclone is not installed. Local backup preserved ($GZ_FILE), but OFFSITE REPLICATION FAILED. Disaster recovery protection is INCOMPLETE."
    exit 2
fi

if ! rclone copy "$GZ_FILE" "$RCLONE_REMOTE" >> "$LOG_FILE" 2>&1; then
    send_alert "CRITICAL" "rclone offsite sync failed. Local backup preserved ($GZ_FILE), but OFFSITE REPLICATION FAILED. Disaster recovery protection is INCOMPLETE."
    exit 2
fi

echo "[$(date)] Offsite replication completed successfully to $RCLONE_REMOTE" >> "$LOG_FILE"

# 6. Prune Local Backups Older than 30 Days
find "$BACKUP_DIR" -name "dentalcore_backup_*.sql.gz" -type f -mtime +30 -delete
echo "[$(date)] Pruning completed. Backup routine finished." >> "$LOG_FILE"
