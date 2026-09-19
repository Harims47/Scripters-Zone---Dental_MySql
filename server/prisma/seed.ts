import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../src/db';

async function main() {
  console.log('Seeding master data only (Development)...');

  const passwordHash = await bcrypt.hash('demo123', 10);

  // 1. Core Users and Staff (3 Roles Only)
  const demoUsers = [
    { username: 'headdoctor', role: 'Head Doctor', name: 'Dr. Arun', phone: '+91 98765 43210' },
    { username: 'dutydoctor', role: 'Duty Doctor', name: 'Dr. Carter', phone: '+91 98765 43220' },
    { username: 'receptionist', role: 'Receptionist', name: 'Reception User', phone: '+91 98765 43215' }
  ];

  for (const user of demoUsers) {
    const existingUser = await prisma.user.findUnique({ where: { username: user.username } });
    if (!existingUser) {
      const staff = await prisma.staff.create({
        data: {
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
  }

  // 2. Medicine Categories Master Data
  const defaultCategories = [
    { id: 'cat1', name: 'Antibiotics', description: 'Medicines commonly used to treat bacterial infections.' },
    { id: 'cat2', name: 'Painkillers', description: 'Analgesics and anti-inflammatory medications for pain management.' },
    { id: 'cat3', name: 'Anesthetics', description: 'Local anesthetics used during dental procedures.' },
    { id: 'cat4', name: 'Antiseptics', description: 'Antiseptic solutions and mouthwashes for infection control.' },
    { id: 'cat5', name: 'Vitamins/Supplements', description: 'Dietary supplements and vitamins.' },
    { id: 'cat6', name: 'Consumables', description: 'General clinic dental consumables and supplies.' },
  ];

  for (const cat of defaultCategories) {
    const existing = await prisma.medicineCategory.findUnique({ where: { id: cat.id } });
    if (!existing) {
      await prisma.medicineCategory.create({
        data: {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          status: 'Active'
        }
      });
    }
  }

  // 3. Medicines Master Data
  const defaultMedicines = [
    { name: 'Amoxicillin 500mg', categoryId: 'cat1', currentStock: 150, stockWarningLevel: 50, unit: 'Tablets', form: 'Tablet', unitPrice: 15 },
    { name: 'Ibuprofen 400mg', categoryId: 'cat2', currentStock: 200, stockWarningLevel: 100, unit: 'Tablets', form: 'Tablet', unitPrice: 8 },
    { name: 'Lidocaine 2%', categoryId: 'cat3', currentStock: 45, stockWarningLevel: 20, unit: 'Vials', form: 'Injection', unitPrice: 120 },
    { name: 'Chlorhexidine', categoryId: 'cat4', currentStock: 30, stockWarningLevel: 15, unit: 'Bottles', form: 'Mouthwash', unitPrice: 85 },
    { name: 'Paracetamol 500mg', categoryId: 'cat2', currentStock: 300, stockWarningLevel: 100, unit: 'Tablets', form: 'Tablet', unitPrice: 5 },
    { name: 'Diclofenac Gel', categoryId: 'cat2', currentStock: 25, stockWarningLevel: 10, unit: 'Tubes', form: 'Ointment', unitPrice: 45 },
  ];

  for (const med of defaultMedicines) {
    const existingMed = await prisma.medicine.findFirst({ where: { name: med.name } });
    if (!existingMed) {
      await prisma.medicine.create({ data: med });
    }
  }

  // 3. Treatment Catalog Master Data
  const treatments = [
    { category: 'Consultation', name: 'Consultation' },
    { category: 'Diagnostic', name: 'X-ray' },
    { category: 'Diagnostic', name: 'Diagnostic' },
    { category: 'Scaling & Curettage', name: 'Scaling & Curettage' },
    { category: 'Fillings', name: 'Silver Amalgam' },
    { category: 'Fillings', name: 'Composite' },
    { category: 'Extraction', name: 'Extraction' },
    { category: 'Extraction', name: 'Surgical Extraction' },
    { category: 'Endodontics', name: 'Root Canal Treatment' },
    { category: 'Crowns', name: 'Full Ceramic' },
    { category: 'Crowns', name: 'Facing Ceramic' },
    { category: 'Crowns', name: 'Zirconia', variant: 'Basic' },
    { category: 'Crowns', name: 'Zirconia', variant: 'Classic' },
    { category: 'Crowns', name: 'Zirconia', variant: 'Premium' },
    { category: 'Crowns', name: 'Acrylic Crown' },
    { category: 'Prosthetic Dentures', name: 'Complete Denture', variant: 'Acrylic' },
    { category: 'Prosthetic Dentures', name: 'Complete Denture', variant: 'Sunflex' },
    { category: 'Prosthetic Dentures', name: 'Partial Denture', variant: 'Acrylic' },
    { category: 'Prosthetic Dentures', name: 'Partial Denture', variant: 'Sunflex' },
    { category: 'Ortho', name: 'Fixed Appliance' },
    { category: 'Ortho', name: 'Removable Appliance' },
    { category: 'Implants', name: 'Dental Implants' }
  ];

  for (const item of treatments) {
    const existing = await prisma.treatmentCatalog.findFirst({
      where: { name: item.name, variant: item.variant || null }
    });
    if (!existing) {
      await prisma.treatmentCatalog.create({
        data: {
          category: item.category,
          name: item.name,
          variant: item.variant || null
        }
      });
    }
  }

  console.log('Database seeded successfully. Transactional data is empty.');
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
