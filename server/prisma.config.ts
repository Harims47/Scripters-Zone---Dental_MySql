import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  migrations: {
    seed: 'npx ts-node --project tsconfig.json ./prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
