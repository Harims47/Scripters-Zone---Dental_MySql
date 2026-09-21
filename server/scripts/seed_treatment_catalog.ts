import dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../src/db';

export interface TreatmentCatalogItemDefinition {
  category: string;
  name: string;
  variant: string | null;
}

export const AUTHORITATIVE_TREATMENT_CATALOG: TreatmentCatalogItemDefinition[] = [
  { category: 'Consultation', name: 'Consultation', variant: null },
  { category: 'Diagnostic', name: 'X-ray', variant: null },
  { category: 'Diagnostic', name: 'Diagnostic', variant: null },
  { category: 'Scaling & Curettage', name: 'Scaling & Curettage', variant: null },
  { category: 'Fillings', name: 'Silver Amalgam', variant: null },
  { category: 'Fillings', name: 'Composite', variant: null },
  { category: 'Extraction', name: 'Extraction', variant: null },
  { category: 'Extraction', name: 'Surgical Extraction', variant: null },
  { category: 'Endodontics', name: 'Root Canal Treatment', variant: null },
  { category: 'Crowns', name: 'Full Ceramic', variant: null },
  { category: 'Crowns', name: 'Facing Ceramic', variant: null },
  { category: 'Crowns', name: 'Zirconia', variant: 'Basic' },
  { category: 'Crowns', name: 'Zirconia', variant: 'Classic' },
  { category: 'Crowns', name: 'Zirconia', variant: 'Premium' },
  { category: 'Crowns', name: 'Acrylic Crown', variant: null },
  { category: 'Prosthetic Dentures', name: 'Complete Denture', variant: 'Acrylic' },
  { category: 'Prosthetic Dentures', name: 'Complete Denture', variant: 'Sunflex' },
  { category: 'Prosthetic Dentures', name: 'Partial Denture', variant: 'Acrylic' },
  { category: 'Prosthetic Dentures', name: 'Partial Denture', variant: 'Sunflex' },
  { category: 'Ortho', name: 'Fixed Appliance', variant: null },
  { category: 'Ortho', name: 'Removable Appliance', variant: null },
  { category: 'Implants', name: 'Dental Implants', variant: null },
];

async function seedTreatmentCatalog(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('Seed aborted: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  // Query existing catalog records
  const existingRecords = await prisma.treatmentCatalog.findMany();

  const itemsToCreate: TreatmentCatalogItemDefinition[] = [];
  let existingCount = 0;

  for (const item of AUTHORITATIVE_TREATMENT_CATALOG) {
    const exists = existingRecords.some(
      (rec) => rec.name === item.name && (rec.variant || null) === (item.variant || null)
    );

    if (exists) {
      existingCount++;
    } else {
      itemsToCreate.push(item);
    }
  }

  let createdCount = 0;

  // Insert missing records inside one atomic Prisma transaction
  if (itemsToCreate.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const item of itemsToCreate) {
        await tx.treatmentCatalog.create({
          data: {
            category: item.category,
            name: item.name,
            variant: item.variant,
            isActive: true,
          },
        });
        createdCount++;
      }
    });
  }

  const totalCount = await prisma.treatmentCatalog.count();

  console.log('Treatment Catalog Seed');
  console.log('----------------------');
  console.log(`Existing: ${existingCount}`);
  console.log(`Created: ${createdCount}`);
  console.log(`Total: ${totalCount}`);
  console.log('Status: Up to date');
}

seedTreatmentCatalog()
  .catch((err) => {
    console.error('Seed failed with error:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
