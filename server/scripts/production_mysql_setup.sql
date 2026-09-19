-- DentalCore Production MySQL 8.0 Least-Privilege Setup Script
-- Authoritative architecture: Separation of Application Runtime vs Schema Migration vs Automated Backup privileges

-- 1. Create dedicated database
CREATE DATABASE IF NOT EXISTS `dentalcore` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 2. Create Application Runtime User (Strict DML Only)
-- This user is used exclusively by the running Express application via DATABASE_URL
CREATE USER IF NOT EXISTS 'dental_app'@'127.0.0.1' IDENTIFIED BY 'STRONG_RUNTIME_PASSWORD_CHANGE_IN_PRODUCTION';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'dental_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `dentalcore`.* TO 'dental_app'@'127.0.0.1';

-- 3. Create Migration/DDL User (Schema Management)
-- This user is used strictly during deployment/CI-CD migrations via MIGRATION_DATABASE_URL
CREATE USER IF NOT EXISTS 'dental_migration'@'127.0.0.1' IDENTIFIED BY 'STRONG_MIGRATION_PASSWORD_CHANGE_IN_PRODUCTION';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'dental_migration'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES ON `dentalcore`.* TO 'dental_migration'@'127.0.0.1';

-- 4. Create Dedicated Automated Backup User (mysqldump non-locking consistency)
-- This user is used exclusively by /usr/local/bin/dentalcore-backup.sh
CREATE USER IF NOT EXISTS 'dental_backup'@'127.0.0.1' IDENTIFIED BY 'STRONG_BACKUP_PASSWORD_CHANGE_IN_PRODUCTION';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'dental_backup'@'127.0.0.1';
-- PROCESS is required by MySQL 8.0 mysqldump to view server-level table metadata & state
GRANT PROCESS ON *.* TO 'dental_backup'@'127.0.0.1';
-- Table-level read, view definition, trigger, and lock metadata privileges
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES ON `dentalcore`.* TO 'dental_backup'@'127.0.0.1';

FLUSH PRIVILEGES;

-- Verification Queries:
-- SHOW GRANTS FOR 'dental_app'@'127.0.0.1';
-- SHOW GRANTS FOR 'dental_migration'@'127.0.0.1';
-- SHOW GRANTS FOR 'dental_backup'@'127.0.0.1';
