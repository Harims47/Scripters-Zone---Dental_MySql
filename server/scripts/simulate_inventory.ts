import { prisma } from '../src/db';

async function main() {
  console.log('--- Simulating Real Inventory Data ---');

  // 1. Categories
  const categoryDefs = [
    {
      name: 'Local Anesthetics & Sedation',
      description: 'Local anesthetics, cartridges, topical numbing gels, and vasoconstrictors for pain management during procedures.'
    },
    {
      name: 'Antibiotics & Therapeutics',
      description: 'Oral and systemic antibiotics for odontogenic infections, surgical prophylaxis, and post-operative care.'
    },
    {
      name: 'Analgesics & Anti-inflammatories',
      description: 'NSAIDs, acute pain relievers, and anti-inflammatory medications for dental pain management.'
    },
    {
      name: 'Endodontic Materials',
      description: 'Root canal sealers, NiTi rotary files, gutta-percha points, EDTA lubricants, and intracanal medicaments.'
    },
    {
      name: 'Restorative & Composite Materials',
      description: 'Light-cure hybrid composites, universal bonding adhesives, etching gels, and glass ionomer restorative cements.'
    },
    {
      name: 'Impression & Prosthodontic Consumables',
      description: 'Dust-free alginates, VPS addition silicones, bite registration pastes, and gypsum dental stones.'
    },
    {
      name: 'Disposables & Infection Control',
      description: 'Sterilization pouches, powder-free nitrile examination gloves, disposable suction tips, and autoclaving indicators.'
    },
    {
      name: 'Surgical & Periodontal Supplies',
      description: 'Sterile surgical suture needles, hemostatic gelatin sponges, surgical scalpels, and periodontal dressings.'
    }
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoryDefs) {
    const record = await prisma.medicineCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description, status: 'Active' },
      create: { name: cat.name, description: cat.description, status: 'Active' }
    });
    categoryMap.set(cat.name, record.id);
  }
  console.log(`✓ Initialized ${categoryMap.size} Medicine & Inventory Categories`);

  // 2. Suppliers
  const supplierDefs = [
    {
      name: 'Apex Dental Diagnostics & Supplies',
      contactPerson: 'Rajesh Kumar',
      phone: '9840123456',
      email: 'orders@apexdental.in',
      address: 'Plot 42, Guindy Industrial Estate, Chennai, Tamil Nadu - 600032',
      categories: ['Restorative & Composite Materials', 'Endodontic Materials', 'Impression & Prosthodontic Consumables']
    },
    {
      name: 'Dentsply Sirona India Pvt Ltd',
      contactPerson: 'Anand Venkatesh',
      phone: '9884567890',
      email: 'supply.india@dentsplysirona.com',
      address: 'Level 4, Prestige Tech Park, Marathahalli, Bangalore, Karnataka - 560103',
      categories: ['Endodontic Materials', 'Restorative & Composite Materials', 'Local Anesthetics & Sedation']
    },
    {
      name: 'MedPlus Pharma & Surgical Wholesalers',
      contactPerson: 'Suresh Menon',
      phone: '9712345678',
      email: 'b2b@medpluspharma.com',
      address: '15/2 Anna Salai, Thousand Lights, Chennai, Tamil Nadu - 600006',
      categories: ['Antibiotics & Therapeutics', 'Analgesics & Anti-inflammatories', 'Local Anesthetics & Sedation']
    },
    {
      name: 'CareMax Infection Control & Disposables',
      contactPerson: 'Kavitha Ranganathan',
      phone: '9940112233',
      email: 'sales@caremaxhygiene.com',
      address: '88 SIDCO Industrial Complex, Ambattur, Chennai, Tamil Nadu - 600058',
      categories: ['Disposables & Infection Control', 'Surgical & Periodontal Supplies']
    },
    {
      name: 'Septodont Healthcare India',
      contactPerson: 'Dr. Vikram Sethi',
      phone: '9820334455',
      email: 'orders@septodont.co.in',
      address: 'C-201 Business Suites, Bandra Kurla Complex, Mumbai, Maharashtra - 400051',
      categories: ['Local Anesthetics & Sedation', 'Surgical & Periodontal Supplies']
    }
  ];

  const supplierMap = new Map<string, string>();
  for (const sup of supplierDefs) {
    let existing = await prisma.supplier.findFirst({ where: { name: sup.name } });
    if (!existing) {
      existing = await prisma.supplier.create({
        data: {
          name: sup.name,
          contactPerson: sup.contactPerson,
          phone: sup.phone,
          email: sup.email,
          address: sup.address,
          status: 'Active'
        }
      });
    } else {
      existing = await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          contactPerson: sup.contactPerson,
          phone: sup.phone,
          email: sup.email,
          address: sup.address,
          status: 'Active'
        }
      });
    }
    supplierMap.set(sup.name, existing.id);

    // Link Supplier to Categories
    for (const catName of sup.categories) {
      const catId = categoryMap.get(catName);
      if (catId) {
        await prisma.supplierMedicineCategory.upsert({
          where: {
            supplierId_medicineCategoryId: {
              supplierId: existing.id,
              medicineCategoryId: catId
            }
          },
          update: {},
          create: {
            supplierId: existing.id,
            medicineCategoryId: catId
          }
        });
      }
    }
  }
  console.log(`✓ Initialized ${supplierMap.size} Suppliers and linked categories`);

  // 3. Realistic Items (Medicines & Materials)
  const itemDefs = [
    // Local Anesthetics
    {
      name: 'Lignox 2% A (Lignocaine + Adrenaline 1:80,000)',
      genericName: 'Lidocaine Hydrochloride 2% with Epinephrine',
      category: 'Local Anesthetics & Sedation',
      form: 'Injection',
      unit: 'Box of 50 Cartridges',
      stockWarningLevel: 20,
      currentStock: 65,
      unitPrice: 950.00
    },
    {
      name: 'Lignospan Special (Mepivacaine 3%)',
      genericName: 'Mepivacaine HCl 3% (Plain without adrenaline)',
      category: 'Local Anesthetics & Sedation',
      form: 'Injection',
      unit: 'Box of 50 Cartridges',
      stockWarningLevel: 10,
      currentStock: 25,
      unitPrice: 1250.00
    },
    {
      name: 'Mucopain 20% Topical Gel (30g)',
      genericName: 'Benzocaine Topical Gel 20%',
      category: 'Local Anesthetics & Sedation',
      form: 'Gel',
      unit: 'Tubes (30g)',
      stockWarningLevel: 8,
      currentStock: 16,
      unitPrice: 180.00
    },
    // Antibiotics
    {
      name: 'Augmentin 625 Duo',
      genericName: 'Amoxicillin 500mg + Potassium Clavulanate 125mg',
      category: 'Antibiotics & Therapeutics',
      form: 'Tablet',
      unit: 'Strip of 10 Tablets',
      stockWarningLevel: 20,
      currentStock: 80,
      unitPrice: 210.00
    },
    {
      name: 'Metrogyl 400',
      genericName: 'Metronidazole 400mg',
      category: 'Antibiotics & Therapeutics',
      form: 'Tablet',
      unit: 'Strip of 15 Tablets',
      stockWarningLevel: 15,
      currentStock: 50,
      unitPrice: 42.00
    },
    {
      name: 'Moxikind-CV 375',
      genericName: 'Amoxicillin 250mg + Clavulanic Acid 125mg',
      category: 'Antibiotics & Therapeutics',
      form: 'Tablet',
      unit: 'Strip of 10 Tablets',
      stockWarningLevel: 10,
      currentStock: 30,
      unitPrice: 145.00
    },
    // Analgesics
    {
      name: 'Zerodol-SP',
      genericName: 'Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg',
      category: 'Analgesics & Anti-inflammatories',
      form: 'Tablet',
      unit: 'Strip of 10 Tablets',
      stockWarningLevel: 25,
      currentStock: 90,
      unitPrice: 125.00
    },
    {
      name: 'Ketorol-DT 10mg',
      genericName: 'Ketorolac Tromethamine 10mg Dispersible',
      category: 'Analgesics & Anti-inflammatories',
      form: 'Tablet',
      unit: 'Strip of 15 Tablets',
      stockWarningLevel: 15,
      currentStock: 35,
      unitPrice: 160.00
    },
    {
      name: 'Chymoral Forte',
      genericName: 'Trypsin-Chymotrypsin Enzymatic Anti-inflammatory',
      category: 'Analgesics & Anti-inflammatories',
      form: 'Tablet',
      unit: 'Strip of 20 Tablets',
      stockWarningLevel: 12,
      currentStock: 40,
      unitPrice: 380.00
    },
    // Endodontic Materials
    {
      name: 'AH Plus Root Canal Sealer',
      genericName: 'Epoxy-Amine Resin Based Endodontic Sealer',
      category: 'Endodontic Materials',
      form: 'Dental Material',
      unit: 'Syringe Kit (2x4ml)',
      stockWarningLevel: 5,
      currentStock: 12,
      unitPrice: 3400.00
    },
    {
      name: 'ProTaper Gold Rotary Files Assorted (SX-F3)',
      genericName: 'NiTi Endodontic Shaping & Finishing Rotary Files',
      category: 'Endodontic Materials',
      form: 'Instrument',
      unit: 'Pack of 6 Files',
      stockWarningLevel: 8,
      currentStock: 22,
      unitPrice: 1850.00
    },
    {
      name: 'Meta Biomed Gutta Percha Points (0.04 Taper / 25#)',
      genericName: 'Standardized Gutta Percha Endodontic Cones',
      category: 'Endodontic Materials',
      form: 'Dental Material',
      unit: 'Box of 60 Points',
      stockWarningLevel: 10,
      currentStock: 35,
      unitPrice: 450.00
    },
    {
      name: 'RC Prep Root Canal Lubricant (9g)',
      genericName: '15% EDTA with 10% Urea Peroxide Lubricant Gel',
      category: 'Endodontic Materials',
      form: 'Dental Material',
      unit: 'Jar (9g)',
      stockWarningLevel: 4,
      currentStock: 9,
      unitPrice: 680.00
    },
    // Restorative & Composite Materials
    {
      name: '3M Filtek Z250 Universal Composite (Shade A2)',
      genericName: 'Microhybrid Light-Cure Restorative Composite',
      category: 'Restorative & Composite Materials',
      form: 'Dental Material',
      unit: 'Syringe (4g)',
      stockWarningLevel: 6,
      currentStock: 18,
      unitPrice: 1650.00
    },
    {
      name: '3M Single Bond Universal Adhesive (5ml)',
      genericName: 'Self-Etch / Total-Etch Light-Cure Dental Adhesive',
      category: 'Restorative & Composite Materials',
      form: 'Dental Material',
      unit: 'Bottle (5ml)',
      stockWarningLevel: 4,
      currentStock: 11,
      unitPrice: 2600.00
    },
    {
      name: 'GC Fuji IX GP Extra (1-1 Package)',
      genericName: 'High-Strength Glass Ionomer Posterior Restorative',
      category: 'Restorative & Composite Materials',
      form: 'Dental Material',
      unit: 'Box (1-1 P/L Kit)',
      stockWarningLevel: 5,
      currentStock: 8,
      unitPrice: 2950.00
    },
    {
      name: 'Prime Dental Phosphoric Acid Etching Gel 37%',
      genericName: '37% Phosphoric Acid Dental Enamel/Dentin Etchant',
      category: 'Restorative & Composite Materials',
      form: 'Dental Material',
      unit: 'Pack of 3 Syringes (3ml)',
      stockWarningLevel: 8,
      currentStock: 24,
      unitPrice: 320.00
    },
    // Disposables & Infection Control
    {
      name: 'SafeTouch Nitrile Examination Gloves (Medium)',
      genericName: 'Medical Grade Powder-Free Textured Nitrile Gloves',
      category: 'Disposables & Infection Control',
      form: 'Consumable',
      unit: 'Box of 100 Gloves',
      stockWarningLevel: 15,
      currentStock: 55,
      unitPrice: 480.00
    },
    {
      name: 'Crosstex Self-Sealing Autoclave Pouches (3.5" x 9")',
      genericName: 'Medical Grade Steam Sterilization Pouches',
      category: 'Disposables & Infection Control',
      form: 'Consumable',
      unit: 'Box of 200 Pouches',
      stockWarningLevel: 8,
      currentStock: 20,
      unitPrice: 850.00
    },
    {
      name: 'Disposable Saliva Ejector Suction Tips (Clear/Blue)',
      genericName: 'Flexible Non-toxic PVC Saliva Ejector Suction Tips',
      category: 'Disposables & Infection Control',
      form: 'Consumable',
      unit: 'Bag of 100 Tips',
      stockWarningLevel: 10,
      currentStock: 40,
      unitPrice: 240.00
    },
    // Surgical & Periodontal
    {
      name: 'Ethicon Mersilk 3-0 Black Braided Silk Sutures',
      genericName: 'Sterile Surgical Suture with 20mm 3/8 Reverse Cutting Needle',
      category: 'Surgical & Periodontal Supplies',
      form: 'Consumable',
      unit: 'Box of 12 Foils',
      stockWarningLevel: 6,
      currentStock: 16,
      unitPrice: 920.00
    },
    {
      name: 'Abgel Absorbable Gelatin Sponge (Sterile)',
      genericName: 'Purified Gelatin Hemostatic Dressing Sponges',
      category: 'Surgical & Periodontal Supplies',
      form: 'Consumable',
      unit: 'Box of 20 Sponges',
      stockWarningLevel: 8,
      currentStock: 22,
      unitPrice: 550.00
    }
  ];

  const itemMap = new Map<string, string>();
  for (const item of itemDefs) {
    const catId = categoryMap.get(item.category);
    if (!catId) continue;

    let existing = await prisma.medicine.findFirst({
      where: { name: item.name }
    });

    if (!existing) {
      existing = await prisma.medicine.create({
        data: {
          name: item.name,
          genericName: item.genericName,
          categoryId: catId,
          form: item.form,
          unit: item.unit,
          stockWarningLevel: item.stockWarningLevel,
          currentStock: item.currentStock,
          unitPrice: item.unitPrice,
          status: 'Active'
        }
      });
    } else {
      existing = await prisma.medicine.update({
        where: { id: existing.id },
        data: {
          genericName: item.genericName,
          categoryId: catId,
          form: item.form,
          unit: item.unit,
          stockWarningLevel: item.stockWarningLevel,
          currentStock: item.currentStock,
          unitPrice: item.unitPrice,
          status: 'Active'
        }
      });
    }
    itemMap.set(item.name, existing.id);
  }
  console.log(`✓ Initialized ${itemMap.size} Realistic Inventory Medicines & Dental Materials`);

  // 4. Purchase Orders
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const poApexId = supplierMap.get('Apex Dental Diagnostics & Supplies');
  const poDentsplyId = supplierMap.get('Dentsply Sirona India Pvt Ltd');
  const poMedPlusId = supplierMap.get('MedPlus Pharma & Surgical Wholesalers');
  const poCareMaxId = supplierMap.get('CareMax Infection Control & Disposables');

  // PO 1: Received & Fully Paid Bill
  const po1Num = `PO-${yyyy}${mm}-001`;
  if (poApexId) {
    await prisma.purchaseOrder.deleteMany({ where: { orderNumber: po1Num } });

    const po1 = await prisma.purchaseOrder.create({
      data: {
        orderNumber: po1Num,
        supplierId: poApexId,
        orderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: 'Received',
        notes: 'Stock replenishment for composites and bonding agents for operative dentistry.',
        items: {
          create: [
            {
              medicineId: itemMap.get('3M Filtek Z250 Universal Composite (Shade A2)')!,
              orderedQuantity: 10,
              receivedQuantity: 10,
              unitCost: 1450.00
            },
            {
              medicineId: itemMap.get('3M Single Bond Universal Adhesive (5ml)')!,
              orderedQuantity: 5,
              receivedQuantity: 5,
              unitCost: 2300.00
            },
            {
              medicineId: itemMap.get('Meta Biomed Gutta Percha Points (0.04 Taper / 25#)')!,
              orderedQuantity: 20,
              receivedQuantity: 20,
              unitCost: 380.00
            }
          ]
        }
      }
    });

    // Create Paid Supplier Bill for PO 1
    const totalAmount = 10 * 1450 + 5 * 2300 + 20 * 380; // 14500 + 11500 + 7600 = 33,600
    const bill1 = await prisma.supplierBill.create({
      data: {
        supplierId: poApexId,
        purchaseOrderId: po1.id,
        invoiceNumber: 'INV-APEX-8921',
        invoiceDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        amount: totalAmount,
        notes: 'Invoice received and cleared via clinic NEFT account.',
        status: 'Paid'
      }
    });

    await prisma.supplierPayment.create({
      data: {
        supplierBillId: bill1.id,
        amount: totalAmount,
        method: 'Bank Transfer',
        notes: 'Bank Ref: NEFT-SBI-99201948',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    });
    console.log(`✓ Created PO: ${po1Num} (Received & Paid)`);
  }

  // PO 2: Partially Received & Partial Bill
  const po2Num = `PO-${yyyy}${mm}-002`;
  if (poDentsplyId) {
    await prisma.purchaseOrder.deleteMany({ where: { orderNumber: po2Num } });

    const po2 = await prisma.purchaseOrder.create({
      data: {
        orderNumber: po2Num,
        supplierId: poDentsplyId,
        orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'Partially Received',
        notes: 'Bulk purchase of endodontic rotary files and AH Plus sealer kits.',
        items: {
          create: [
            {
              medicineId: itemMap.get('AH Plus Root Canal Sealer')!,
              orderedQuantity: 10,
              receivedQuantity: 5,
              unitCost: 3000.00
            },
            {
              medicineId: itemMap.get('ProTaper Gold Rotary Files Assorted (SX-F3)')!,
              orderedQuantity: 15,
              receivedQuantity: 15,
              unitCost: 1600.00
            }
          ]
        }
      }
    });

    // Total ordered: 10*3000 + 15*1600 = 30000 + 24000 = 54,000
    const bill2 = await prisma.supplierBill.create({
      data: {
        supplierId: poDentsplyId,
        purchaseOrderId: po2.id,
        invoiceNumber: 'DS-IN-44021',
        invoiceDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        amount: 54000.00,
        notes: 'Advance installment paid. Balance due upon delivery of remaining 5 sealers.',
        status: 'Partial'
      }
    });

    await prisma.supplierPayment.create({
      data: {
        supplierBillId: bill2.id,
        amount: 30000.00,
        method: 'UPI',
        notes: 'UPI Ref: 429188201948@okhdfcbank',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    });
    console.log(`✓ Created PO: ${po2Num} (Partially Received & Partial Payment)`);
  }

  // PO 3: Ordered / In Transit
  const po3Num = `PO-${yyyy}${mm}-003`;
  if (poMedPlusId) {
    await prisma.purchaseOrder.deleteMany({ where: { orderNumber: po3Num } });

    await prisma.purchaseOrder.create({
      data: {
        orderNumber: po3Num,
        supplierId: poMedPlusId,
        orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'Ordered',
        notes: 'Urgent restocking of broad-spectrum antibiotics and emergency analgesics for clinic dispensary.',
        items: {
          create: [
            {
              medicineId: itemMap.get('Augmentin 625 Duo')!,
              orderedQuantity: 40,
              receivedQuantity: 0,
              unitCost: 185.00
            },
            {
              medicineId: itemMap.get('Zerodol-SP')!,
              orderedQuantity: 50,
              receivedQuantity: 0,
              unitCost: 105.00
            },
            {
              medicineId: itemMap.get('Ketorol-DT 10mg')!,
              orderedQuantity: 30,
              receivedQuantity: 0,
              unitCost: 135.00
            }
          ]
        }
      }
    });
    console.log(`✓ Created PO: ${po3Num} (Ordered / In Transit)`);
  }

  // PO 4: Draft
  const po4Num = `PO-${yyyy}${mm}-004`;
  if (poCareMaxId) {
    await prisma.purchaseOrder.deleteMany({ where: { orderNumber: po4Num } });

    await prisma.purchaseOrder.create({
      data: {
        orderNumber: po4Num,
        supplierId: poCareMaxId,
        orderDate: now,
        status: 'Draft',
        notes: 'Monthly infection control reorder: nitrile gloves, suction tips, and autoclave pouches.',
        items: {
          create: [
            {
              medicineId: itemMap.get('SafeTouch Nitrile Examination Gloves (Medium)')!,
              orderedQuantity: 30,
              receivedQuantity: 0,
              unitCost: 410.00
            },
            {
              medicineId: itemMap.get('Crosstex Self-Sealing Autoclave Pouches (3.5" x 9")')!,
              orderedQuantity: 10,
              receivedQuantity: 0,
              unitCost: 750.00
            },
            {
              medicineId: itemMap.get('Disposable Saliva Ejector Suction Tips (Clear/Blue)')!,
              orderedQuantity: 25,
              receivedQuantity: 0,
              unitCost: 200.00
            }
          ]
        }
      }
    });
    console.log(`✓ Created PO: ${po4Num} (Draft)`);
  }

  console.log('--- Inventory Simulation Completed Successfully ---');
}

main()
  .catch(err => {
    console.error('Simulation failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
