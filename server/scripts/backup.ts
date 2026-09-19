import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const rawDbUrl = process.env.DATABASE_URL;
if (!rawDbUrl) {
  console.error('ERROR: DATABASE_URL not defined in server/.env');
  process.exit(1);
}

// Clean query params
const parsedUrl = new URL(rawDbUrl);
const dbUser = decodeURIComponent(parsedUrl.username);
const dbPassword = decodeURIComponent(parsedUrl.password);
const dbHost = parsedUrl.hostname;
const dbPort = parsedUrl.port || '3306';
const dbName = parsedUrl.pathname.replace(/^\//, '');

// Locate mysqldump
const dumpCandidates = [
  'mysqldump',
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
  'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe',
  'C:\\Program Files\\MariaDB 10.11\\bin\\mysqldump.exe'
];

let dumpPath = 'mysqldump';
for (const candidate of dumpCandidates) {
  if (candidate === 'mysqldump') {
    try {
      execSync('mysqldump --version', { stdio: 'ignore' });
      dumpPath = 'mysqldump';
      break;
    } catch {
      // not in path
    }
  } else if (fs.existsSync(candidate)) {
    dumpPath = `"${candidate}"`;
    break;
  }
}

const backupDir = path.resolve(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `dentalcore_mysql_backup_${timestamp}.sql`;
const backupFilePath = path.join(backupDir, backupFilename);

console.log(`Starting MySQL backup using ${dumpPath}...`);
console.log(`Destination: ${backupFilePath}`);

try {
  // Execute non-destructive mysqldump
  const passArg = dbPassword ? `--password="${dbPassword}"` : '';
  execSync(
    `${dumpPath} --user="${dbUser}" ${passArg} --host="${dbHost}" --port="${dbPort}" --single-transaction --quick --default-character-set=utf8mb4 --result-file="${backupFilePath}" "${dbName}"`,
    { stdio: 'inherit' }
  );

  const stats = fs.statSync(backupFilePath);
  console.log(`Backup completed successfully!`);
  console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`Location: ${backupFilePath}`);
} catch (err) {
  console.error('Backup failed:', err);
  process.exit(1);
}
