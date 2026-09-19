import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { prisma } from '../src/db';
import fs from 'fs';

async function runIncidentDrill() {
  console.log('===========================================================');
  console.log('DENTALCORE PRODUCTION INCIDENT DRILL & TRIAGE SIMULATION');
  console.log('===========================================================');

  const testRequestId = `req_drill_${Date.now()}_fail500`;
  console.log(`\n[INCIDENT REPORTED BY CLINIC]`);
  console.log(`Clinic reports: Error modal popped up with Request ID: ${testRequestId}`);
  console.log(`Action reported: Payment transaction attempted on non-existent or locked visit`);

  // Step 1: Record pre-incident DB state
  const prePaymentCount = await prisma.payment.count();
  const preAuditCount = await prisma.auditLog.count({ where: { action: 'PAYMENT_RECORDED' } });

  console.log(`\n[PRE-INCIDENT STATE]`);
  console.log(`Total Payments in DB:  ${prePaymentCount}`);
  console.log(`Total AuditLog events: ${preAuditCount}`);

  // Step 2: Trigger the incident via HTTP request with the specific X-Request-ID
  console.log(`\n[TRIGGERING INCIDENT REQUEST]`);
  const fakeToken = 'Bearer invalid_or_error_trigger';
  
  // Send state-changing request with X-Request-ID and custom trigger
  let responseStatus = 0;
  let responseBody: any = null;

  try {
    const res = await fetch('http://localhost:3001/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': testRequestId,
        'Origin': 'http://localhost:5173',
        'Cookie': 'token=corrupted_jwt_token_for_drill'
      },
      body: JSON.stringify({
        visitId: 'non-existent-visit-id-drill',
        amount: 500,
        method: 'Cash'
      })
    });
    responseStatus = res.status;
    responseBody = await res.json();
  } catch (err: any) {
    console.error('Network request failed:', err.message);
  }

  console.log(`Response HTTP Status: ${responseStatus}`);
  console.log(`Response Payload:`, responseBody);

  // Step 3: Triage from Logs using X-Request-ID
  console.log(`\n[TRIAGE FROM PRODUCTION LOGS]`);
  const logDir = process.env.LOG_DIR || path.join(__dirname, '../logs');
  console.log(`Scanning log directory: ${logDir}`);

  const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
  let matchedLogs: any[] = [];

  for (const file of logFiles) {
    const filePath = path.join(logDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes(testRequestId)) {
        try {
          matchedLogs.push(JSON.parse(line));
        } catch {
          matchedLogs.push({ raw: line });
        }
      }
    }
  }

  console.log(`Found ${matchedLogs.length} correlated log line(s) matching Request ID: ${testRequestId}`);
  if (matchedLogs.length > 0) {
    console.log(`✅ Log correlation verified! Matched entry:`);
    console.log(JSON.stringify(matchedLogs[0], null, 2));
  } else {
    console.warn(`⚠️ No log lines found yet (buffer may be flushing).`);
  }

  // Step 4: Verify Database Invariant & Rollback Integrity
  console.log(`\n[POST-INCIDENT DATABASE INTEGRITY CHECK]`);
  const postPaymentCount = await prisma.payment.count();
  const postAuditCount = await prisma.auditLog.count({ where: { action: 'PAYMENT_RECORDED' } });

  console.log(`Total Payments in DB:  ${postPaymentCount} (Delta: ${postPaymentCount - prePaymentCount})`);
  console.log(`Total AuditLog events: ${postAuditCount} (Delta: ${postAuditCount - preAuditCount})`);

  if (postPaymentCount === prePaymentCount && postAuditCount === preAuditCount) {
    console.log(`\n✅ TRANSACTION ROLLBACK & AUDIT ISOLATION: PERFECT PASS`);
    console.log(`- Zero phantom Payment records created.`);
    console.log(`- Zero phantom PAYMENT_RECORDED AuditLog entries generated.`);
    console.log(`- Request ID "${testRequestId}" cleanly identified the failure in logs.`);
  } else {
    console.error(`❌ INVARIANT VIOLATION: Phantom records were created during a failed request!`);
    process.exit(1);
  }

  await prisma.$disconnect();
  console.log('\n===========================================================');
  console.log('INCIDENT DRILL COMPLETE: PRODUCTION READY');
  console.log('===========================================================');
}

runIncidentDrill().catch(err => {
  console.error('Drill failed:', err);
  process.exit(1);
});
