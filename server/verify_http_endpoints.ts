import { prisma } from './src/db';
import jwt from 'jsonwebtoken';
import http from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

async function requestAPI(path: string, token: string): Promise<{ status: number; headers: Record<string, any>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'GET',
      headers: {
        'Cookie': `token=${token}`
      }
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function verifyHttpRoutes() {
  console.log('====================================================');
  console.log('HTTP ENDPOINT & RBAC EXPORT VERIFICATION');
  console.log('====================================================\n');

  // 1. Get Head Doctor and Receptionist users
  const headDocUser = await prisma.user.findFirst({ where: { role: 'Head Doctor' } });
  const receptionistUser = await prisma.user.findFirst({ where: { role: 'Receptionist' } });

  if (!headDocUser) throw new Error('No Head Doctor user found in DB');
  const headDocToken = jwt.sign({ id: headDocUser.id, role: headDocUser.role }, JWT_SECRET, { expiresIn: '1h' });

  let receptionistToken = '';
  if (receptionistUser) {
    receptionistToken = jwt.sign({ id: receptionistUser.id, role: receptionistUser.role }, JWT_SECRET, { expiresIn: '1h' });
  }

  // 2. Test RBAC: Receptionist should be blocked (401 or 403)
  if (receptionistToken) {
    const forbiddenRes = await requestAPI('/api/reports/overview', receptionistToken);
    assert(forbiddenRes.status === 401 || forbiddenRes.status === 403,
      'RBAC Protection: Receptionist blocked from /api/reports/overview', forbiddenRes.status);
  }

  // 3. Test HTTP Endpoints as Head Doctor
  const endpoints = [
    '/api/reports/summary',
    '/api/reports/overview',
    '/api/reports/visits?limit=5',
    '/api/reports/revenue?limit=5',
    '/api/reports/patients?limit=5',
    '/api/reports/treatments?limit=5',
    '/api/reports/doctors',
    '/api/reports/medicines?limit=5',
    '/api/reports/inventory-movements?limit=5',
    '/api/reports/procurement?limit=5'
  ];

  for (const ep of endpoints) {
    const res = await requestAPI(ep, headDocToken);
    assert(res.status === 200, `HTTP GET ${ep} returns 200 OK`, res.status);
  }

  // 4. Test Export Endpoints (CSV, XLSX, PDF)
  console.log('\n--- Export Formats Verification ---');
  const exportTests = [
    { ep: '/api/reports/visits/export?format=csv', mime: 'text/csv', name: 'Visits CSV Export' },
    { ep: '/api/reports/visits/export?format=xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'Visits XLSX Export' },
    { ep: '/api/reports/visits/export?format=pdf', mime: 'application/pdf', name: 'Visits PDF Export' },
    { ep: '/api/reports/revenue/export?format=csv', mime: 'text/csv', name: 'Revenue CSV Export' },
    { ep: '/api/reports/revenue/export?format=xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'Revenue XLSX Export' },
    { ep: '/api/reports/revenue/export?format=pdf', mime: 'application/pdf', name: 'Revenue PDF Export' },
    { ep: '/api/reports/doctors/export?format=csv', mime: 'text/csv', name: 'Doctors CSV Export' },
    { ep: '/api/reports/medicines/export?format=xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'Medicines XLSX Export' },
    { ep: '/api/reports/inventory-movements/export?format=pdf', mime: 'application/pdf', name: 'Inventory Movements PDF Export' },
    { ep: '/api/reports/procurement/export?format=csv', mime: 'text/csv', name: 'Procurement CSV Export' }
  ];

  for (const t of exportTests) {
    const res = await requestAPI(t.ep, headDocToken);
    const contentType = res.headers['content-type'];
    const hasCorrectMime = contentType && contentType.includes(t.mime);
    const isNonEmpty = res.body.length > 0;
    assert(res.status === 200 && hasCorrectMime && isNonEmpty,
      `${t.name} returns HTTP 200 with non-empty ${t.mime}`, { status: res.status, size: res.body.length, contentType });
  }

  console.log('\n====================================================');
  console.log(`HTTP & EXPORT VERIFICATION FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

verifyHttpRoutes()
  .catch(err => {
    console.error('Fatal error during HTTP verification:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
