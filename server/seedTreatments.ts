import { prisma } from './src/db';

const catalog = [
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

async function seed() {
  console.log('Seeding Treatment Catalog...');
  for (const item of catalog) {
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
  console.log('Done!');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
