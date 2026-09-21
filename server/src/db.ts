import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

let prismaInitCount = 0;
prismaInitCount++;
console.log(`[Diagnostic] PrismaClient initialized (count: ${prismaInitCount})`);

const adapter = new PrismaMariaDb(connectionString);
export const prisma = new PrismaClient({ adapter });

