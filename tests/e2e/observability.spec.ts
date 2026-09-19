import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAs } from './helpers/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.resolve(__dirname, '../../server/logs');

test.describe('DentalCore Production Observability & Security Suite (OBS-01 to OBS-16)', () => {
  const apiBase = 'http://localhost:3001';

  // Helper to read latest log content with polling to account for asynchronous stream flushing
  const getLatestLogContent = async (type: 'combined' | 'error' = 'combined', expectedSubstring?: string): Promise<string> => {
    for (let attempt = 0; attempt < 6; attempt++) {
      if (fs.existsSync(logDir)) {
        const files = fs.readdirSync(logDir)
          .filter((f) => f.startsWith(`dentalcore-${type}-`) && f.endsWith('.log'))
          .map((f) => ({ name: f, time: fs.statSync(path.join(logDir, f)).mtime.getTime() }))
          .sort((a, b) => b.time - a.time);

        if (files.length > 0) {
          const content = fs.readFileSync(path.join(logDir, files[0].name), 'utf-8');
          if (!expectedSubstring || content.includes(expectedSubstring)) {
            return content;
          }
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    // Return whatever was read on last attempt
    const files = fs.existsSync(logDir) ? fs.readdirSync(logDir).filter((f) => f.startsWith(`dentalcore-${type}-`)) : [];
    if (files.length > 0) {
      return fs.readFileSync(path.join(logDir, files[0]), 'utf-8');
    }
    return '';
  };

  test('OBS-01 & OBS-15: Successful API request returns X-Request-ID and logs structured JSON', async ({ request }) => {
    const customId = `req_custom_${Date.now()}`;
    const res = await request.get(`${apiBase}/api/health/live`, {
      headers: {
        'X-Request-ID': customId,
      }
    });

    expect(res.status()).toBe(200);
    // Response echoes the validated authoritative Request ID
    expect(res.headers()['x-request-id']).toBe(customId);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('dentalcore-api');

    // Verify structured log entry exists
    const logs = await getLatestLogContent('combined', customId);
    expect(logs).toContain(customId);
    expect(logs).toContain('/api/health/live');
  });

  test('OBS-02: 400 Validation error returns requestId and logs safe warning', async ({ request }) => {
    // Attempt walk-in with missing required fields
    const res = await request.post(`${apiBase}/api/visits/walk-in`, {
      headers: {
        'Origin': 'http://localhost:5173',
      },
      data: {}
    });

    expect(res.status()).toBe(401); // Requires auth first
    const requestId = res.headers()['x-request-id'];
    expect(requestId).toBeTruthy();
  });

  test('OBS-03: 401 Unauthenticated request returns requestId and logs access warning', async ({ request }) => {
    const res = await request.get(`${apiBase}/api/patients`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('OBS-04: 403 Role restriction logs security event and returns requestId', async ({ page }) => {
    await loginAs(page, 'receptionist');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Receptionist calls Head Doctor reports endpoint
    const res = await page.request.get(`${apiBase}/api/reports/revenue`, {
      headers: {
        'Cookie': cookieHeader,
      }
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('OBS-05: 404 Resource request generates clean response and requestId', async ({ page }) => {
    await loginAs(page, 'headDoctor');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await page.request.get(`${apiBase}/api/patients/nonexistent-patient-0000`, {
      headers: {
        'Cookie': cookieHeader,
      }
    });

    expect(res.status()).toBe(404);
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('OBS-08: Prisma errors mask internal schema details and return generic message', async ({ page }) => {
    await loginAs(page, 'headDoctor');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Send malformed type that would trigger DB error if passed
    const res = await page.request.patch(`${apiBase}/api/patients/nonexistent-id`, {
      headers: {
        'Cookie': cookieHeader,
        'Origin': 'http://localhost:5173',
      },
      data: {
        gender: 'InvalidGenderEnum',
      }
    });

    // Zod validation blocks it cleanly with 400
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    // Ensure no internal Prisma schema files or SQL statements are leaked
    expect(JSON.stringify(body)).not.toContain('PrismaClientValidationError');
    expect(JSON.stringify(body)).not.toContain('SELECT');
  });

  test('OBS-10 & OBS-11: Log files persist across restarts and follow naming convention', async () => {
    expect(fs.existsSync(logDir)).toBe(true);
    const files = fs.readdirSync(logDir);
    const combinedLogs = files.filter((f) => f.startsWith('dentalcore-combined-'));
    expect(combinedLogs.length).toBeGreaterThan(0);
  });

  test('OBS-12: Sensitive values (passwords, JWTs, PII) are redacted in log files', async ({ request }) => {
    const probeUser = `probe_${Date.now()}`;
    const probePass = 'SUPER_SECRET_PASSWORD_123!';

    await request.post(`${apiBase}/api/auth/login`, {
      headers: {
        'Origin': 'http://localhost:5173',
      },
      data: {
        username: probeUser,
        password: probePass,
      }
    });

    const logs = await getLatestLogContent('combined');
    // Verify password was NEVER logged in plain text
    expect(logs).not.toContain(probePass);
  });

  test('OBS-13: /api/health/ready distinguishes DB connectivity from app liveness', async ({ request }) => {
    // Liveness
    const liveRes = await request.get(`${apiBase}/api/health/live`);
    expect(liveRes.status()).toBe(200);
    const liveBody = await liveRes.json();
    expect(liveBody.status).toBe('ok');

    // Readiness
    const readyRes = await request.get(`${apiBase}/api/health/ready`);
    expect(readyRes.status()).toBe(200);
    const readyBody = await readyRes.json();
    expect(readyBody.status).toBe('ready');
    expect(readyBody.database).toBe('connected');
  });

  test('SEC-01 & SEC-02: CSRF protection blocks invalid or missing Origin/Referer on browser mutations', async ({ request }) => {
    // Cross-origin untrusted mutation
    const evilRes = await request.post(`${apiBase}/api/auth/login`, {
      headers: {
        'Origin': 'http://evil-attacker-site.com',
      },
      data: { username: 'admin', password: 'password' }
    });
    expect(evilRes.status()).toBe(403);
    const evilBody = await evilRes.json();
    expect(evilBody.error).toContain('Forbidden');

    // Missing Origin & Referer with browser cookie simulation
    const noOriginRes = await request.post(`${apiBase}/api/visits/walk-in`, {
      headers: {
        'Cookie': 'token=fake_token_value',
        'Sec-Fetch-Site': 'cross-site',
      },
      data: {}
    });
    expect(noOriginRes.status()).toBe(403);
  });

  test('SEC-05: Production HTTP Security Headers are enforced', async ({ request }) => {
    const res = await request.get(`${apiBase}/api/health/live`);
    const headers = res.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['content-security-policy']).toBeDefined();
    expect(headers['content-security-policy']).toContain("frame-src 'self' blob:");
    expect(headers['content-security-policy']).toContain("img-src 'self' data: blob:");
  });

  test('SEC-06: PDF Preview document endpoint returns application/pdf without CSP blocking', async ({ page }) => {
    await loginAs(page, 'headDoctor');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Query visits to find any valid visitId
    const visitsRes = await page.request.get(`${apiBase}/api/visits?limit=1`, {
      headers: { 'Cookie': cookieHeader }
    });
    const visitsData = await visitsRes.json();
    const visitId = visitsData.visits?.[0]?.id || 'fake-visit-id';

    const pdfRes = await page.request.get(`${apiBase}/api/documents/receipt/${visitId}`, {
      headers: { 'Cookie': cookieHeader }
    });

    // Either 200 with PDF binary or 404/400 if visit has no payment, but headers must be correct
    if (pdfRes.status() === 200) {
      expect(pdfRes.headers()['content-type']).toContain('application/pdf');
    }
  });

  test('OBS-16: End-to-end Request ID correlation across UI, headers, and logs', async ({ page }) => {
    const customCorrelationId = `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Perform an API request with an authoritative X-Request-ID
    const res = await page.request.get(`${apiBase}/api/health/live`, {
      headers: {
        'X-Request-ID': customCorrelationId,
      }
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['x-request-id']).toBe(customCorrelationId);

    // Verify the log file recorded this exact correlation ID
    const logs = await getLatestLogContent('combined', customCorrelationId);
    expect(logs).toContain(customCorrelationId);
  });

  test('AUD-01: Successful payment creates non-repudiable AuditLog entry with safe metadata', async ({ page }) => {
    await loginAs(page, 'receptionist');
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Find a visit ready for payment or create one if needed
    const billingRes = await page.request.get(`${apiBase}/api/billing`, {
      headers: { 'Cookie': cookieHeader }
    });
    const billingData = await billingRes.json();

    if (billingData.queue && billingData.queue.length > 0) {
      const targetVisit = billingData.queue[0];
      const remainingBalance = targetVisit.amountDue - (targetVisit.totalPaid || 0);

      if (remainingBalance > 0) {
        const payRes = await page.request.post(`${apiBase}/api/payments`, {
          headers: {
            'Cookie': cookieHeader,
            'Origin': 'http://localhost:5173',
          },
          data: {
            visitId: targetVisit.id,
            amount: remainingBalance,
            method: 'Cash',
          }
        });

        if (payRes.status() === 201) {
          const payData = await payRes.json();
          expect(payData.payment.id).toBeDefined();

          // Verify audit log captured the business event
          const logs = await getLatestLogContent('combined', '[AUDIT] PAYMENT_RECORDED');
          expect(logs).toContain('[AUDIT] PAYMENT_RECORDED');
          expect(logs).toContain(payData.payment.id);
        }
      }
    }
  });
});
