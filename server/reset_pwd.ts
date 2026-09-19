import bcrypt from 'bcryptjs';
import { prisma } from './src/db';

async function reset() {
  const hash = await bcrypt.hash('demo123', 10);
  const res = await prisma.user.updateMany({
    data: { passwordHash: hash }
  });
  console.log('Updated users count:', res.count);
  const users = await prisma.user.findMany({ select: { username: true, role: true } });
  console.log('Available users:', users);
}

reset()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
