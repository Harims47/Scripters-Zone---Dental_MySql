import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db';

async function bootstrapHeadDoctor(): Promise<void> {
  const rawUsername = process.env.HEAD_DOCTOR_USERNAME;
  const rawPassword = process.env.HEAD_DOCTOR_PASSWORD;
  const rawName = process.env.HEAD_DOCTOR_NAME;
  const rawPhone = process.env.HEAD_DOCTOR_PHONE;

  // 1. Validation: Required Environment Variables
  const missingVars: string[] = [];
  if (!rawUsername || !rawUsername.trim()) missingVars.push('HEAD_DOCTOR_USERNAME');
  if (!rawPassword) missingVars.push('HEAD_DOCTOR_PASSWORD');
  if (!rawName || !rawName.trim()) missingVars.push('HEAD_DOCTOR_NAME');
  if (!rawPhone || !rawPhone.trim()) missingVars.push('HEAD_DOCTOR_PHONE');

  if (missingVars.length > 0) {
    console.error(`Bootstrap aborted: Missing required environment variable(s): ${missingVars.join(', ')}`);
    process.exit(1);
  }

  // 2. Validation: Empty or whitespace-only password check
  if (rawPassword.trim().length === 0) {
    console.error('Bootstrap aborted: HEAD_DOCTOR_PASSWORD cannot be empty or whitespace-only.');
    process.exit(1);
  }

  // 3. Validation: Password strength rules
  const passwordErrors: string[] = [];
  if (rawPassword.length < 12) {
    passwordErrors.push('Password must be at least 12 characters in length');
  }
  if (!/[A-Z]/.test(rawPassword)) {
    passwordErrors.push('Password must include at least one uppercase letter');
  }
  if (!/[a-z]/.test(rawPassword)) {
    passwordErrors.push('Password must include at least one lowercase letter');
  }
  if (!/[0-9]/.test(rawPassword)) {
    passwordErrors.push('Password must include at least one numeric digit');
  }
  if (!/[^A-Za-z0-9]/.test(rawPassword)) {
    passwordErrors.push('Password must include at least one special character');
  }

  if (passwordErrors.length > 0) {
    console.error('Bootstrap aborted: HEAD_DOCTOR_PASSWORD does not meet security requirements:');
    passwordErrors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  }

  const username = rawUsername.trim();
  const name = rawName.trim();
  const phone = rawPhone.trim();

  // 4. Idempotency: Check whether username already exists
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });
  if (existingUser) {
    console.log(`Bootstrap skipped: User with username "${username}" already exists.`);
    process.exit(0);
  }

  // 5. Idempotency: Check whether Head Doctor already exists
  const existingHeadDocUser = await prisma.user.findFirst({
    where: { role: 'Head Doctor' }
  });
  const existingHeadDocStaff = await prisma.staff.findFirst({
    where: { role: 'Head Doctor' }
  });

  if (existingHeadDocUser || existingHeadDocStaff) {
    console.log('Bootstrap skipped: A Head Doctor account already exists in this database.');
    process.exit(0);
  }

  // 6. Creation: Execute in a single atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    const staff = await tx.staff.create({
      data: {
        name,
        phone,
        role: 'Head Doctor',
        status: 'Active',
        attendance: 'Present'
      }
    });

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await tx.user.create({
      data: {
        username,
        passwordHash,
        role: 'Head Doctor',
        staffId: staff.id
      }
    });

    // Verify relationship
    const verifiedUser = await tx.user.findUnique({
      where: { id: user.id },
      include: { staff: true }
    });

    if (!verifiedUser || !verifiedUser.staff || verifiedUser.staffId !== staff.id) {
      throw new Error('Integrity validation failed: User and Staff relation could not be verified.');
    }

    return {
      username: verifiedUser.username,
      role: verifiedUser.role,
      staffId: verifiedUser.staffId
    };
  });

  // 7. Output: Print only safe confirmation info
  console.log('Head Doctor bootstrap completed.');
  console.log(`Username: ${result.username}`);
  console.log(`Role: ${result.role}`);
  console.log(`Staff ID: ${result.staffId}`);
}

bootstrapHeadDoctor()
  .catch((error) => {
    console.error('Bootstrap failed with error:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
