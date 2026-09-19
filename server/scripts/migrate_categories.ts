import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Creating MedicineCategory table if not exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "MedicineCategory" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'Active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MedicineCategory_pkey" PRIMARY KEY ("id")
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "MedicineCategory_name_key" ON "MedicineCategory"("name");
    `);

    console.log('Seeding existing categories with IDs cat1..cat6...');
    const defaultCategories = [
      { id: 'cat1', name: 'Antibiotics', description: 'Medicines commonly used to treat bacterial infections.' },
      { id: 'cat2', name: 'Painkillers', description: 'Analgesics and anti-inflammatory medications for pain management.' },
      { id: 'cat3', name: 'Anesthetics', description: 'Local anesthetics used during dental procedures.' },
      { id: 'cat4', name: 'Antiseptics', description: 'Antiseptic solutions and mouthwashes for infection control.' },
      { id: 'cat5', name: 'Vitamins/Supplements', description: 'Dietary supplements and vitamins.' },
      { id: 'cat6', name: 'Consumables', description: 'General clinic dental consumables and supplies.' },
    ];

    for (const cat of defaultCategories) {
      await pool.query(`
        INSERT INTO "MedicineCategory" ("id", "name", "description", "status", "updatedAt")
        VALUES ($1, $2, $3, 'Active', CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description";
      `, [cat.id, cat.name, cat.description]);
    }

    console.log('Checking foreign key constraint...');
    const fkCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'Medicine' AND constraint_name = 'Medicine_categoryId_fkey';
    `);

    if (fkCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE "Medicine" 
        ADD CONSTRAINT "Medicine_categoryId_fkey" 
        FOREIGN KEY ("categoryId") REFERENCES "MedicineCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
      console.log('Foreign key constraint added successfully.');
    } else {
      console.log('Foreign key constraint already exists.');
    }

    const checkCats = await pool.query('SELECT id, name, status FROM "MedicineCategory"');
    console.log('Seeded categories in DB:', checkCats.rows);

    const checkMeds = await pool.query('SELECT count(*) FROM "Medicine"');
    console.log('Medicines in DB:', checkMeds.rows[0]);

    console.log('Migration completed successfully!');
  } finally {
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
