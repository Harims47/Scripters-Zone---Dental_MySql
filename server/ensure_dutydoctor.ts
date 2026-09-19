import { prisma } from './src/db';
import bcrypt from 'bcryptjs';

async function main() {
  const hash = await bcrypt.hash('demo123', 10);
  
  let staff = await prisma.staff.findFirst({
    where: {
      name: 'Dr. QA Duty Doctor'
    }
  });

  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        name: 'Dr. QA Duty Doctor',
        role: 'Duty Doctor',
        status: 'Active',
        attendance: 'Present',
        phone: '9876543210',
        roomNumber: 'Room 102'
      }
    });
    console.log(`Created QA Duty Doctor staff record: ${staff.id}`);
  }

  const existingUser = await prisma.user.findUnique({ where: { username: 'dutydoctor' } });
  if (!existingUser) {
    await prisma.user.create({
      data: {
        username: 'dutydoctor',
        passwordHash: hash,
        role: 'Duty Doctor',
        staffId: staff.id
      }
    });
    console.log(`Created dutydoctor account linked to ${staff.name} (${staff.id})`);
  } else {
    await prisma.user.update({
      where: { username: 'dutydoctor' },
      data: { passwordHash: hash, staffId: staff.id, role: 'Duty Doctor' }
    });
    console.log(`Updated dutydoctor account linked to ${staff.name} (${staff.id})`);
  }
}

main().finally(() => prisma.$disconnect());
