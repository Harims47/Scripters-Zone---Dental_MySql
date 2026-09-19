import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaMariaDb(connectionString);
export const prisma = new PrismaClient({ adapter });

