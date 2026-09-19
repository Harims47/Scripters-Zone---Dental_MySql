import { prisma } from './src/db.js';
import bcrypt from 'bcryptjs';

async function main() {
  await prisma.payment.deleteMany({});
  await prisma.prescriptionItem.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.queueEntry.deleteMany({});
  await prisma.dispensingItem.deleteMany({});
  await prisma.dispensing.deleteMany({});
  await prisma.visit.deleteMany({});
  
  await prisma.patient.deleteMany({
    where: { name: { startsWith: 'Error Test User' } }
  });
  await prisma.patient.deleteMany({
    where: { name: { startsWith: 'John Doe' } }
  });

  // Re-seed Staff with EXACT IDs to match DEMO_STAFF in frontend
  await prisma.user.deleteMany({});
  await prisma.staff.deleteMany({});

  const passwordHash = await bcrypt.hash('demo123', 10);

  const demoUsers = [
    { id: 'STF-001', username: 'headdoctor', role: 'Head Doctor', name: 'Dr. Arun', phone: '+91 98765 43210' },
    { id: 'STF-111', username: 'dutydoctor', role: 'Duty Doctor', name: 'Dr. Carter', phone: '+91 98765 43220' },
    { id: 'STF-222', username: 'receptionist', role: 'Receptionist', name: 'Reception User', phone: '+91 98765 43215' }
  ];

  for (const user of demoUsers) {
    const staff = await prisma.staff.create({
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: 'Active'
      }
    });

    await prisma.user.create({
      data: {
        username: user.username,
        passwordHash,
        role: user.role,
        staffId: staff.id
      }
    });
  }

  console.log('Database cleaned and seeded with explicit Staff IDs!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
