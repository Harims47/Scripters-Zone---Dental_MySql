import { prisma } from '../src/db';
import bcrypt from 'bcryptjs';

async function seedQA() {
  console.log('Seeding realistic Indian dental clinic dataset for QA...');

  const passwordHash = await bcrypt.hash('demo123', 10);

  // 1. STAFF & USERS
  console.log('Creating staff and users...');
  const staffMembers = [
    {
      username: 'headdoctor',
      name: 'Dr. Rajesh Sharma',
      role: 'Head Doctor',
      phone: '9840123456',
      email: 'dr.rajesh@dentalcore.in',
      roomNumber: 'Room 1 (Surgical)'
    },
    {
      username: 'dutydoctor',
      name: 'Dr. Priya Venkatesh',
      role: 'Duty Doctor',
      phone: '9840234567',
      email: 'dr.priya@dentalcore.in',
      roomNumber: 'Room 2 (General)'
    },
    {
      username: 'receptionist',
      name: 'Kavitha Sundaram',
      role: 'Receptionist',
      phone: '9840345678',
      email: 'kavitha@dentalcore.in',
      roomNumber: 'Front Desk A'
    },
    {
      username: 'receptionist2',
      name: 'Ananya Ramesh',
      role: 'Receptionist',
      phone: '9840456789',
      email: 'ananya@dentalcore.in',
      roomNumber: 'Front Desk B'
    }
  ];

  const staffMap: Record<string, any> = {};

  for (const s of staffMembers) {
    const staff = await prisma.staff.create({
      data: {
        name: s.name,
        role: s.role,
        phone: s.phone,
        status: 'Active',
        attendance: 'Present',
        roomNumber: s.roomNumber
      }
    });

    await prisma.user.create({
      data: {
        username: s.username,
        passwordHash,
        role: s.role,
        staffId: staff.id
      }
    });

    staffMap[s.username] = staff;
  }

  // 2. MEDICINE CATEGORIES
  console.log('Creating medicine categories...');
  const categoriesData = [
    { id: 'cat-antibiotics', name: 'Antibiotics', description: 'Oral and injectable antibacterial formulations' },
    { id: 'cat-analgesics', name: 'Analgesics & Pain Relief', description: 'NSAIDs, anti-inflammatory and pain relief medications' },
    { id: 'cat-anesthetics', name: 'Local Anesthetics', description: 'Lidocaine and Articaine dental cartridges and topical gels' },
    { id: 'cat-antiseptics', name: 'Antiseptics & Rinses', description: 'Chlorhexidine mouthwashes and pre-procedural rinses' },
    { id: 'cat-restoratives', name: 'Restorative Materials', description: 'Composites, bonding agents, and glass ionomer cements' },
    { id: 'cat-consumables', name: 'Dental Consumables', description: 'Gloves, cotton rolls, saliva ejectors, and barriers' }
  ];

  for (const cat of categoriesData) {
    await prisma.medicineCategory.create({
      data: {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        status: 'Active'
      }
    });
  }

  // 3. MEDICINES
  console.log('Creating medicines...');
  const medicinesData = [
    { id: 'med-amox-500', name: 'Amoxicillin 500mg', categoryId: 'cat-antibiotics', currentStock: 180, stockWarningLevel: 40, unit: 'Tablets', form: 'Tablet', unitPrice: 12.5 },
    { id: 'med-aug-625', name: 'Augmentin 625mg', categoryId: 'cat-antibiotics', currentStock: 90, stockWarningLevel: 25, unit: 'Tablets', form: 'Tablet', unitPrice: 28.0 },
    { id: 'med-ibu-400', name: 'Ibuprofen 400mg', categoryId: 'cat-analgesics', currentStock: 220, stockWarningLevel: 50, unit: 'Tablets', form: 'Tablet', unitPrice: 6.5 },
    { id: 'med-para-650', name: 'Paracetamol 650mg', categoryId: 'cat-analgesics', currentStock: 350, stockWarningLevel: 60, unit: 'Tablets', form: 'Tablet', unitPrice: 4.0 },
    { id: 'med-lignox-2', name: 'Lignox 2% Adrenaline', categoryId: 'cat-anesthetics', currentStock: 65, stockWarningLevel: 20, unit: 'Cartridges', form: 'Injection', unitPrice: 45.0 },
    { id: 'med-chx-02', name: 'Chlorhexidine 0.2% Rinse', categoryId: 'cat-antiseptics', currentStock: 40, stockWarningLevel: 15, unit: 'Bottles', form: 'Mouthwash', unitPrice: 95.0 },
    { id: 'med-comp-a2', name: 'Filtek Z250 Composite A2', categoryId: 'cat-restoratives', currentStock: 18, stockWarningLevel: 5, unit: 'Syringes', form: 'Composite', unitPrice: 1450.0 },
    { id: 'med-gloves-m', name: 'Latex Examination Gloves M', categoryId: 'cat-consumables', currentStock: 450, stockWarningLevel: 100, unit: 'Pieces', form: 'Gloves', unitPrice: 5.0 },
    { id: 'med-cotton-rolls', name: 'Dental Cotton Rolls #2', categoryId: 'cat-consumables', currentStock: 800, stockWarningLevel: 200, unit: 'Pieces', form: 'Cotton', unitPrice: 1.5 }
  ];

  const medicineMap: Record<string, any> = {};
  for (const med of medicinesData) {
    const created = await prisma.medicine.create({ data: med });
    medicineMap[med.id] = created;
  }

  // 4. SUPPLIERS & CATALOG
  console.log('Creating suppliers...');
  const suppliersData = [
    {
      name: 'Apex Dental Supplies Ltd',
      contactPerson: 'Harish Mehta',
      phone: '9820156789',
      email: 'sales@apexdental.co.in',
      address: 'Plot 42, Guindy Industrial Estate, Chennai, Tamil Nadu 600032',
      categories: ['cat-consumables', 'cat-restoratives']
    },
    {
      name: 'Southern Healthcare Pharma',
      contactPerson: 'Ramesh Balan',
      phone: '9841267890',
      email: 'orders@southernpharma.in',
      address: '14/2 Anna Salai, Teynampet, Chennai, Tamil Nadu 600018',
      categories: ['cat-antibiotics', 'cat-analgesics', 'cat-anesthetics']
    },
    {
      name: 'MediDent Surgical Equipment',
      contactPerson: 'Suresh Menon',
      phone: '9880345678',
      email: 'info@medidentsurgical.in',
      address: '88 Brigade Road, Ashok Nagar, Bengaluru, Karnataka 560025',
      categories: ['cat-antiseptics', 'cat-consumables']
    }
  ];

  const supplierMap: Record<string, any> = {};
  for (const s of suppliersData) {
    const supplier = await prisma.supplier.create({
      data: {
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        categories: {
          create: s.categories.map(catId => ({
            medicineCategory: { connect: { id: catId } }
          }))
        }
      }
    });
    supplierMap[s.name] = supplier;
  }

  // 5. TREATMENT CATALOG
  console.log('Creating dental treatment catalog...');
  const treatmentsData = [
    { category: 'Consultation', name: 'Comprehensive Oral Examination', cost: 500 },
    { category: 'Diagnostic', name: 'Digital IOPA X-Ray', cost: 300 },
    { category: 'Preventive', name: 'Full Mouth Scaling & Polishing', cost: 1200 },
    { category: 'Restorative', name: 'Light Cure Composite Restoration', cost: 1500 },
    { category: 'Endodontics', name: 'Root Canal Treatment (Molar)', cost: 4500 },
    { category: 'Endodontics', name: 'Root Canal Treatment (Anterior)', cost: 3500 },
    { category: 'Prosthodontics', name: 'Zirconia Monolithic Crown', variant: 'Premium', cost: 8500 },
    { category: 'Prosthodontics', name: 'Porcelain Fused to Metal Crown', variant: 'Standard', cost: 4000 },
    { category: 'Surgery', name: 'Simple Extraction', cost: 1000 },
    { category: 'Surgery', name: 'Surgical Disimpaction (Wisdom Tooth)', cost: 4000 },
    { category: 'Orthodontics', name: 'Fixed Metal Braces (Upper & Lower)', cost: 35000 }
  ];

  const treatmentMap: Record<string, any> = {};
  for (const tx of treatmentsData) {
    const created = await prisma.treatmentCatalog.create({
      data: {
        category: tx.category,
        name: tx.name,
        variant: tx.variant || null,
        isActive: true
      }
    });
    treatmentMap[tx.name] = created;
  }

  // 6. PATIENTS (16 Realistic Indian Patients)
  console.log('Creating 16 realistic patient records...');
  const patientsData = [
    { name: 'Vikramaditya Iyer', phone: '9840111222', age: 46, gender: 'Male', address: '12 Temple View Road, Mylapore, Chennai 600004', email: 'vikram.iyer@gmail.com' },
    { name: 'Meera Krishnan', phone: '9840222333', age: 34, gender: 'Female', address: '45 Lake Area, Nungambakkam, Chennai 600034', email: 'meera.k@outlook.com' },
    { name: 'Aarav Nambiar', phone: '9840333444', age: 28, gender: 'Male', address: '8/1 Cross Cut Road, Gandhipuram, Coimbatore 641012', email: 'aarav.n@gmail.com' },
    { name: 'Sunita Deshmukh', phone: '9840444555', age: 52, gender: 'Female', address: '102 Deccan Heights, Shivajinagar, Pune 411005', email: 'sunita.d@yahoo.com' },
    { name: 'Rohan Kulkarni', phone: '9840555666', age: 31, gender: 'Male', address: '23 Prabhat Road, Erandwane, Pune 411004', email: 'rohan.kulkarni@gmail.com' },
    { name: 'Deepa Subramanian', phone: '9840666777', age: 39, gender: 'Female', address: '67 Eldams Road, Teynampet, Chennai 600018', email: 'deepa.subramanian@gmail.com' },
    { name: 'Karthik Ramanathan', phone: '9840777888', age: 41, gender: 'Male', address: '15 Luz Church Road, Mylapore, Chennai 600004', email: 'karthik.ram@gmail.com' },
    { name: 'Pooja Nair', phone: '9840888999', age: 26, gender: 'Female', address: '19 Marine Drive, Ernakulam, Kochi 682011', email: 'pooja.nair@hotmail.com' },
    { name: 'Arjun Hegde', phone: '9840999000', age: 35, gender: 'Male', address: '54 Malleshwaram 8th Cross, Bengaluru 560003', email: 'arjun.hegde@gmail.com' },
    { name: 'Lakshmi Narayanan', phone: '9841112233', age: 63, gender: 'Female', address: '30 Gandhi Street, T. Nagar, Chennai 600017', email: 'lakshmi.n@gmail.com' },
    { name: 'Suresh Chandran', phone: '9841223344', age: 58, gender: 'Male', address: '77 Race Course Road, Madurai 625002', email: 'suresh.chandran@gmail.com' },
    { name: 'Divya Balasubramanian', phone: '9841334455', age: 29, gender: 'Female', address: '20 Besant Avenue, Adyar, Chennai 600020', email: 'divya.bala@gmail.com' },
    { name: 'Manoj Prabhakar', phone: '9841445566', age: 49, gender: 'Male', address: '11 Kasturi Ranga Road, Alwarpet, Chennai 600018', email: 'manoj.p@gmail.com' },
    { name: 'Swathi Ranganathan', phone: '9841556677', age: 33, gender: 'Female', address: '88 Harrington Road, Chetpet, Chennai 600031', email: 'swathi.r@gmail.com' },
    { name: 'Venkatesh Prasad', phone: '9841667788', age: 50, gender: 'Male', address: '44 Indira Nagar 100ft Road, Bengaluru 560038', email: 'v.prasad@gmail.com' },
    { name: 'Gayatri Mukund', phone: '9841778899', age: 24, gender: 'Female', address: '55 1st Seaward Road, Valmiki Nagar, Thiruvanmiyur, Chennai 600041', email: 'gayatri.m@gmail.com' }
  ];

  const patientMap: Record<string, any> = {};
  for (const p of patientsData) {
    const created = await prisma.patient.create({
      data: {
        name: p.name,
        phone: p.phone,
        age: p.age,
        gender: p.gender,
        address: p.address,
        email: p.email,
        status: 'Active'
      }
    });
    patientMap[p.name] = created;
  }

  // 7. CLINICAL VISITS, APPOINTMENTS, TREATMENTS & PAYMENTS SCENARIOS
  const todayStr = new Date().toISOString().split('T')[0];
  const headDoctor = staffMap['headdoctor'];
  const dutyDoctor = staffMap['dutydoctor'];

  // SCENARIO A: Vikramaditya Iyer — Completed RCT visit with Full Payment + Issued Reimbursement Document
  console.log('Creating Scenario A (Full Payment + Reimbursement Document)...');
  const pA = patientMap['Vikramaditya Iyer'];
  const apptA = await prisma.appointment.create({
    data: {
      patientId: pA.id,
      providerId: null,
      date: todayStr,
      time: '09:30 AM',
      type: 'Consultation',
      status: 'Completed',
      notes: 'Root canal treatment follow-up'
    }
  });

  const visitA = await prisma.visit.create({
    data: {
      patientId: pA.id,
      doctorId: headDoctor.id,
      appointmentId: apptA.id,
      status: 'COMPLETED',
      amountDue: 5000,
      consultationFee: 500,
      treatmentFee: 4500,
      medicineCost: 0,
      reasonForVisit: 'Severe throbbing pain in lower right tooth 46',
      paymentOwner: 'RECEPTION',
      visitDate: new Date()
    }
  });

  await prisma.consultation.create({
    data: {
      visitId: visitA.id,
      doctorId: headDoctor.id,
      consultationFee: 500,
      reasonForVisit: 'Severe throbbing pain in lower right tooth 46',
      clinicalNotes: 'Deep occlusal caries involving pulp in tooth 46. Tender to percussion. RCT advised.'
    }
  });

  const planA = await prisma.treatmentPlan.create({
    data: {
      patientId: pA.id
    }
  });

  await prisma.treatmentPlanItem.create({
    data: {
      treatmentPlanId: planA.id,
      treatmentCatalogId: treatmentMap['Root Canal Treatment (Molar)'].id,
      status: 'Completed',
      completedVisitId: visitA.id,
      completedAt: new Date(),
      notes: 'Biomechanical preparation done. Obturation completed using gutta-percha for tooth 46.'
    }
  });

  await prisma.payment.create({
    data: {
      patientId: pA.id,
      visitId: visitA.id,
      amount: 5000,
      method: 'Credit Card',
      date: todayStr,
      status: 'Completed',
      notes: 'Full payment settled via HDFC POS machine'
    }
  });

  // Reimbursement document for Vikramaditya Iyer
  await prisma.reimbursementDocument.create({
    data: {
      documentNumber: 'RMB-2026-000001',
      patientId: pA.id,
      doctorId: headDoctor.id,
      visitId: visitA.id,
      documentDate: todayStr,
      subject: 'Reimbursement of Dental Treatment Expenses',
      content: 'This is to certify that Mr. Vikramaditya Iyer (Age: 46, Male) underwent endodontic treatment at DentalCore Clinic. The procedure was clinically indicated due to irreversible pulpitis in tooth 46.',
      treatmentDescription: 'Single-sitting Root Canal Treatment and Core Build-up for tooth 46',
      amount: 5000,
      patientNameSnapshot: pA.name,
      patientAgeSnapshot: pA.age,
      patientGenderSnapshot: pA.gender,
      patientPhoneSnapshot: pA.phone,
      doctorNameSnapshot: headDoctor.name,
      doctorRegNoSnapshot: 'TN-DEN-45892',
      clinicNameSnapshot: 'DentalCore Multispeciality Dental Centre',
      clinicAddressSnapshot: '12 Cathedral Road, Chennai 600086',
      clinicPhoneSnapshot: '+91 44 2811 0099',
      status: 'Issued'
    }
  });

  // SCENARIO B: Meera Krishnan — Partial Payment Scenario (Due ₹2,700, Paid ₹1,200, Balance ₹1,500)
  console.log('Creating Scenario B (Partial Payment)...');
  const pB = patientMap['Meera Krishnan'];
  const visitB = await prisma.visit.create({
    data: {
      patientId: pB.id,
      doctorId: dutyDoctor.id,
      status: 'IN_PROGRESS',
      amountDue: 2700,
      consultationFee: 500,
      treatmentFee: 1500,
      medicineCost: 700,
      reasonForVisit: 'Cavity filling and gum cleaning',
      paymentOwner: 'RECEPTION',
      visitDate: new Date()
    }
  });

  await prisma.consultation.create({
    data: {
      visitId: visitB.id,
      doctorId: dutyDoctor.id,
      consultationFee: 500,
      reasonForVisit: 'Cavity filling and gum cleaning',
      clinicalNotes: 'Mild marginal gingivitis. Class I caries tooth 36.'
    }
  });

  await prisma.payment.create({
    data: {
      patientId: pB.id,
      visitId: visitB.id,
      amount: 1200,
      method: 'GPay',
      date: todayStr,
      status: 'Completed',
      notes: 'Initial advance payment via UPI'
    }
  });

  // Prescription for Meera Krishnan
  const rxB = await prisma.prescription.create({
    data: {
      visitId: visitB.id,
      doctorId: dutyDoctor.id,
      notes: 'Take medicines after meals for 5 days'
    }
  });

  await prisma.prescriptionItem.create({
    data: {
      prescriptionId: rxB.id,
      medicineId: medicineMap['med-amox-500'].id,
      dosage: '500mg',
      frequency: '1-0-1 (Twice a day)',
      duration: '5 Days',
      quantity: 10,
      instructions: 'Take with warm water after food'
    }
  });

  await prisma.prescriptionItem.create({
    data: {
      prescriptionId: rxB.id,
      medicineId: medicineMap['med-ibu-400'].id,
      dosage: '400mg',
      frequency: '1-0-1 (As needed)',
      duration: '3 Days',
      quantity: 6,
      instructions: 'Take only if pain occurs'
    }
  });

  // SCENARIO C: Aarav Nambiar — DOCTOR-OWNED PAYMENT (Handled by Doctor privacy check)
  console.log('Creating Scenario C (Doctor-Owned Payment)...');
  const pC = patientMap['Aarav Nambiar'];
  const visitC = await prisma.visit.create({
    data: {
      patientId: pC.id,
      doctorId: headDoctor.id,
      status: 'COMPLETED',
      amountDue: 3500,
      consultationFee: 500,
      treatmentFee: 3000,
      reasonForVisit: 'Private specialized aesthetic consultation',
      paymentOwner: 'DOCTOR', // Critical: Doctor-owned payment
      visitDate: new Date()
    }
  });

  await prisma.consultation.create({
    data: {
      visitId: visitC.id,
      doctorId: headDoctor.id,
      consultationFee: 500,
      reasonForVisit: 'Aesthetic smile evaluation',
      clinicalNotes: 'Midline diastema correction discussed. Composite veneer option chosen.'
    }
  });

  await prisma.payment.create({
    data: {
      patientId: pC.id,
      visitId: visitC.id,
      amount: 3500,
      method: 'Cash',
      date: todayStr,
      status: 'Completed',
      notes: 'Collected directly by Dr. Rajesh Sharma in operatory'
    }
  });

  // SCENARIO D: Active Waiting Queue Patients
  console.log('Creating Scenario D (Active Queue entries)...');
  const pD1 = patientMap['Sunita Deshmukh'];
  const visitD1 = await prisma.visit.create({
    data: {
      patientId: pD1.id,
      doctorId: dutyDoctor.id,
      status: 'WAITING',
      amountDue: 500,
      consultationFee: 500,
      reasonForVisit: 'Routine dental check-up and sensitivity',
      paymentOwner: 'RECEPTION',
      visitDate: new Date()
    }
  });

  await prisma.queueEntry.create({
    data: {
      visitId: visitD1.id,
      patientId: pD1.id,
      assignedDoctorId: dutyDoctor.id,
      position: 1,
      status: 'Waiting',
      priority: false,
      arrivalTime: '09:30 AM'
    }
  });

  const pD2 = patientMap['Rohan Kulkarni'];
  const visitD2 = await prisma.visit.create({
    data: {
      patientId: pD2.id,
      doctorId: headDoctor.id,
      status: 'WAITING',
      amountDue: 500,
      consultationFee: 500,
      reasonForVisit: 'Wisdom tooth swelling and difficulty swallowing',
      paymentOwner: 'RECEPTION',
      visitDate: new Date()
    }
  });

  await prisma.queueEntry.create({
    data: {
      visitId: visitD2.id,
      patientId: pD2.id,
      assignedDoctorId: headDoctor.id,
      position: 2,
      status: 'Waiting',
      priority: true,
      arrivalTime: '10:00 AM'
    }
  });

  // SCENARIO E: Upcoming Appointments (Today & Tomorrow)
  console.log('Creating Scenario E (Appointments)...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  await prisma.appointment.create({
    data: {
      patientId: patientMap['Deepa Subramanian'].id,
      providerId: null,
      date: todayStr,
      time: '02:30 PM',
      type: 'Crown Placement',
      status: 'Scheduled',
      notes: 'Zirconia crown trial for tooth 14'
    }
  });

  await prisma.appointment.create({
    data: {
      patientId: patientMap['Karthik Ramanathan'].id,
      providerId: null,
      date: todayStr,
      time: '04:00 PM',
      type: 'Cleaning',
      status: 'Scheduled',
      notes: 'Periodic 6-month prophylaxis'
    }
  });

  await prisma.appointment.create({
    data: {
      patientId: patientMap['Pooja Nair'].id,
      providerId: null,
      date: tomorrowStr,
      time: '11:00 AM',
      type: 'Surgical Extraction',
      status: 'Scheduled',
      notes: 'Impacted 38 disimpaction under LA'
    }
  });

  // SCENARIO F: Procurement (Purchase Orders & Supplier Bills)
  console.log('Creating Scenario F (Purchase Orders & Supplier Bills)...');
  const supplierA = supplierMap['Apex Dental Supplies Ltd'];
  const po1 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: 'PO-2026-0001',
      supplierId: supplierA.id,
      orderDate: new Date(),
      status: 'Received',
      items: {
        create: [
          {
            medicineId: medicineMap['med-gloves-m'].id,
            orderedQuantity: 200,
            receivedQuantity: 200,
            unitCost: 4.5
          },
          {
            medicineId: medicineMap['med-cotton-rolls'].id,
            orderedQuantity: 400,
            receivedQuantity: 400,
            unitCost: 1.2
          }
        ]
      }
    }
  });

  const bill1 = await prisma.supplierBill.create({
    data: {
      invoiceNumber: 'INV-APEX-8901',
      supplierId: supplierA.id,
      purchaseOrderId: po1.id,
      invoiceDate: new Date(),
      amount: 1380,
      status: 'Paid',
      notes: 'Goods received in good condition and fully settled'
    }
  });

  await prisma.supplierPayment.create({
    data: {
      supplierBillId: bill1.id,
      amount: 1380,
      date: new Date(),
      method: 'Bank Transfer',
      notes: 'NEFT Transfer ref: SBIN002938491'
    }
  });

  // Record stock movements
  await prisma.stockMovement.create({
    data: {
      medicineId: medicineMap['med-gloves-m'].id,
      movementType: 'PURCHASE_RECEIPT',
      quantity: 200,
      balanceAfter: 450,
      referenceType: 'PURCHASE_ORDER',
      referenceId: po1.id,
      reason: 'Goods received from Apex Dental Supplies Ltd',
      performedBy: 'headdoctor'
    }
  });

  // SCENARIO G: Historical Controlled Data
  console.log('Creating Scenario G (Historical Batch)...');
  const histBatch = await prisma.historicalMigrationBatch.create({
    data: {
      name: 'Batch-2025-Clinic-Archive.pdf',
      status: 'COMPLETED',
      totalPages: 1,
      processedRecords: 1,
      approvedRecords: 1,
      importedRecords: 1
    }
  });

  const histPatient = patientMap['Suresh Chandran'];
  await prisma.historicalMigrationRecord.create({
    data: {
      batchId: histBatch.id,
      pageNumber: 1,
      sourceFileKey: 'archive_2025_page_1.png',
      sourceFileName: 'Batch-2025-Clinic-Archive.pdf',
      status: 'IMPORTED',
      proposedName: histPatient.name,
      proposedPhone: histPatient.phone,
      proposedAge: histPatient.age,
      proposedGender: histPatient.gender,
      proposedVisitDate: new Date('2025-06-15T10:00:00Z'),
      proposedReason: 'Routine scaling and filling',
      reviewedName: histPatient.name,
      reviewedPhone: histPatient.phone,
      reviewedAge: histPatient.age,
      reviewedGender: histPatient.gender,
      reviewedVisitDate: new Date('2025-06-15T10:00:00Z'),
      reviewedReason: 'Routine scaling and filling',
      duplicateStatus: 'EXACT_MATCH',
      duplicateResolution: 'USE_EXISTING',
      matchedPatientId: histPatient.id,
      importedPatientId: histPatient.id,
      importedAt: new Date()
    }
  });

  // SCENARIO H: Communication Notifications (Controlled local mock data)
  await prisma.notification.create({
    data: {
      type: 'APPOINTMENT_CONFIRMATION',
      channel: 'WHATSAPP',
      status: 'SENT',
      recipientName: 'Deepa Subramanian',
      recipientPhone: '+919840666777',
      templateName: 'appointment_confirmation_v1',
      payload: { appointmentTime: '02:30 PM', doctorName: 'Dr. Rajesh Sharma' },
      sentAt: new Date()
    }
  });

  console.log('✅ REALISTIC QA SEED COMPLETE!');
}

seedQA().catch(console.error).finally(() => prisma.$disconnect());
