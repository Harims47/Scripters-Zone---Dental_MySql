import { prisma } from './src/db';

async function seedSimulation() {
  console.log('--- Simulating Realistic Patients and Complete Historical Records ---');

  // 1. Ensure Staff / Doctors exist
  let headDoc = await prisma.staff.findFirst({ where: { role: 'Head Doctor' } });
  if (!headDoc) {
    headDoc = await prisma.staff.create({
      data: { name: 'Dr. Arun Kumar', phone: '9840123456', role: 'Head Doctor', status: 'Active', roomNumber: '101' }
    });
  }

  let dutyDoc = await prisma.staff.findFirst({ where: { role: 'Duty Doctor' } });
  if (!dutyDoc) {
    dutyDoc = await prisma.staff.create({
      data: { name: 'Dr. Priya Sharma', phone: '9840654321', role: 'Duty Doctor', status: 'Active', roomNumber: '102' }
    });
  }

  // 2. Ensure Medicine Category & Medicines exist
  let catAnti = await prisma.medicineCategory.upsert({
    where: { name: 'Antibiotics' },
    update: {},
    create: { name: 'Antibiotics', description: 'Broad spectrum antimicrobial agents' }
  });

  let catAnalgesic = await prisma.medicineCategory.upsert({
    where: { name: 'Analgesics' },
    update: {},
    create: { name: 'Analgesics', description: 'Pain management and anti-inflammatory' }
  });

  let catRinse = await prisma.medicineCategory.upsert({
    where: { name: 'Antiseptic Rinses' },
    update: {},
    create: { name: 'Antiseptic Rinses', description: 'Oral antiseptic and post-op rinses' }
  });

  const amox = await prisma.medicine.upsert({
    where: { id: 'med-amox-500' },
    update: { currentStock: 50 },
    create: {
      id: 'med-amox-500',
      name: 'Amoxicillin 500mg',
      categoryId: catAnti.id,
      form: 'Capsule',
      unit: 'capsule',
      stockWarningLevel: 15,
      currentStock: 50,
      unitPrice: 12
    }
  });

  const ibugesic = await prisma.medicine.upsert({
    where: { id: 'med-ibugesic-plus' },
    update: { currentStock: 80 },
    create: {
      id: 'med-ibugesic-plus',
      name: 'Ibuprofen + Paracetamol (Ibugesic Plus)',
      categoryId: catAnalgesic.id,
      form: 'Tablet',
      unit: 'tablet',
      stockWarningLevel: 20,
      currentStock: 80,
      unitPrice: 8
    }
  });

  const hexidine = await prisma.medicine.upsert({
    where: { id: 'med-hexidine-mouthwash' },
    update: { currentStock: 25 },
    create: {
      id: 'med-hexidine-mouthwash',
      name: 'Chlorhexidine Gluconate 0.2% Rinse',
      categoryId: catRinse.id,
      form: 'Liquid',
      unit: 'bottle',
      stockWarningLevel: 5,
      currentStock: 25,
      unitPrice: 110
    }
  });

  // 3. Ensure Treatment Catalog items exist
  const rctMolar = await prisma.treatmentCatalog.upsert({
    where: { id: 'trt-rct-molar' },
    update: {},
    create: {
      id: 'trt-rct-molar',
      category: 'Endodontics',
      name: 'Root Canal Treatment',
      variant: 'Molar (3-4 Canals)',
      isActive: true
    }
  });

  const ceramicCrown = await prisma.treatmentCatalog.upsert({
    where: { id: 'trt-zirconia-crown' },
    update: {},
    create: {
      id: 'trt-zirconia-crown',
      category: 'Prosthodontics',
      name: 'Zirconia Crown Placement',
      variant: 'Monolithic High Translucency',
      isActive: true
    }
  });

  const scaling = await prisma.treatmentCatalog.upsert({
    where: { id: 'trt-scaling-polishing' },
    update: {},
    create: {
      id: 'trt-scaling-polishing',
      category: 'Periodontics',
      name: 'Full Mouth Scaling & Deep Ultrasonic Polishing',
      variant: 'Full Mouth',
      isActive: true
    }
  });

  const compositeRestoration = await prisma.treatmentCatalog.upsert({
    where: { id: 'trt-composite-restoration' },
    update: {},
    create: {
      id: 'trt-composite-restoration',
      category: 'Restorative',
      name: 'Composite Resin Restoration (Class II)',
      variant: 'Premolar / Molar',
      isActive: true
    }
  });

  // =========================================================================
  // PATIENT 1: Rajesh Ramanathan (3 Visits, Multiple Doctors, Partial & Multi-Payments)
  // =========================================================================
  const p1 = await prisma.patient.upsert({
    where: { phone: '9841029384' },
    update: {
      address: 'Flat 4B, Emerald Heights, Anna Nagar, Chennai',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces'
    },
    create: {
      name: 'Rajesh Ramanathan',
      phone: '9841029384',
      age: 44,
      gender: 'Male',
      address: 'Flat 4B, Emerald Heights, Anna Nagar, Chennai',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
      status: 'Active'
    }
  });

  // P1 Treatment Plan
  const p1Plan = await prisma.treatmentPlan.upsert({
    where: { patientId: p1.id },
    update: {},
    create: { patientId: p1.id }
  });

  // P1 Planned roadmap item (Crown pending in roadmap)
  await prisma.treatmentPlanItem.create({
    data: {
      treatmentPlanId: p1Plan.id,
      treatmentCatalogId: ceramicCrown.id,
      status: 'Planned',
      notes: 'Crown preparation and shade selection scheduled after RCT settles.'
    }
  });

  // Visit 1 for Rajesh: Initial Emergency Visit (Dr. Arun Kumar)
  const p1Appt1 = await prisma.appointment.create({
    data: {
      patientId: p1.id,
      providerId: headDoc.id,
      date: '2026-08-15',
      time: '10:30 AM',
      type: 'Emergency',
      status: 'Completed',
      notes: 'Excruciating pain on lower right tooth #46.'
    }
  });

  const p1Visit1 = await prisma.visit.create({
    data: {
      patientId: p1.id,
      doctorId: headDoc.id,
      appointmentId: p1Appt1.id,
      status: 'COMPLETED',
      amountDue: 2500,
      consultationFee: 500,
      treatmentFee: 2000,
      medicineCost: 0,
      reasonForVisit: 'Severe throbbing pain in lower jaw',
      createdAt: new Date('2026-08-15T10:45:00Z')
    }
  });

  await prisma.consultation.create({
    data: {
      visitId: p1Visit1.id,
      doctorId: headDoc.id,
      reasonForVisit: 'Severe throbbing pain in lower jaw',
      clinicalNotes: 'Tooth #46 shows deep occlusal decay with pulp involvement. Percussion positive. Vitality test negative. Urgent pulpectomy initiated.',
      consultationFee: 500
    }
  });

  // Completed treatment for Visit 1
  await prisma.treatmentPlanItem.create({
    data: {
      treatmentPlanId: p1Plan.id,
      treatmentCatalogId: rctMolar.id,
      status: 'Completed',
      notes: 'Access opened, canals negotiated (MB, ML, D), biomechanical preparation and Ca(OH)2 dressing placed.',
      completedVisitId: p1Visit1.id,
      completedAt: new Date('2026-08-15T11:30:00Z')
    }
  });

  // Multiple payments for Visit 1 (Total ₹2,500: Cash ₹1,000 + GPay ₹1,500)
  await prisma.payment.createMany({
    data: [
      { visitId: p1Visit1.id, patientId: p1.id, amount: 1000, method: 'Cash', status: 'Completed', notes: 'Initial token advance', date: '2026-08-15', createdAt: new Date('2026-08-15T10:50:00Z') },
      { visitId: p1Visit1.id, patientId: p1.id, amount: 1500, method: 'GPay', status: 'Completed', notes: 'Settled via UPI upon procedure completion', date: '2026-08-15', createdAt: new Date('2026-08-15T11:45:00Z') }
    ]
  });

  // Prescription for Visit 1
  const p1Rx1 = await prisma.prescription.create({
    data: {
      visitId: p1Visit1.id,
      doctorId: headDoc.id,
      status: 'Finalized',
      notes: 'Complete antibiotic course strictly. Take painkiller SOS after food.'
    }
  });

  await prisma.prescriptionItem.createMany({
    data: [
      { prescriptionId: p1Rx1.id, medicineId: amox.id, quantity: 15, dosage: '500mg', frequency: '1-0-1 (Twice daily)', duration: '5 days', instructions: 'Take after meals' },
      { prescriptionId: p1Rx1.id, medicineId: ibugesic.id, quantity: 10, dosage: '1 tablet', frequency: 'SOS (As needed)', duration: '3 days', instructions: 'Take with full glass of water' }
    ]
  });

  // Dispensing for Visit 1 (Prescribed 15 Amox -> Dispensed 15; Prescribed 10 Ibugesic -> Dispensed 10)
  const p1Disp1 = await prisma.dispensing.create({
    data: { visitId: p1Visit1.id, prescriptionId: p1Rx1.id, status: 'Completed' }
  });

  await prisma.dispensingItem.createMany({
    data: [
      { dispensingId: p1Disp1.id, medicineId: amox.id, prescribedQuantity: 15, dispensedQuantity: 15 },
      { dispensingId: p1Disp1.id, medicineId: ibugesic.id, prescribedQuantity: 10, dispensedQuantity: 10 }
    ]
  });

  // Visit 2 for Rajesh: Follow-up & Obturation (Dr. Priya Sharma - Duty Doctor)
  const p1Visit2 = await prisma.visit.create({
    data: {
      patientId: p1.id,
      doctorId: dutyDoc.id,
      status: 'COMPLETED',
      amountDue: 1800,
      consultationFee: 0,
      treatmentFee: 1800,
      medicineCost: 0,
      reasonForVisit: 'RCT Obturation and Core Build-up',
      createdAt: new Date('2026-08-25T15:00:00Z')
    }
  });

  await prisma.consultation.create({
    data: {
      visitId: p1Visit2.id,
      doctorId: dutyDoc.id,
      reasonForVisit: 'RCT Obturation and Core Build-up',
      clinicalNotes: 'Patient asymptomatic. Canals dry. Gutta-percha obturation completed with AH Plus sealer. Dual-cure composite core build-up done.',
      consultationFee: 0
    }
  });

  // Completed treatment item for Visit 2
  await prisma.treatmentPlanItem.create({
    data: {
      treatmentPlanId: p1Plan.id,
      treatmentCatalogId: compositeRestoration.id,
      status: 'Completed',
      notes: 'Core build-up with post placement on distal canal #46.',
      completedVisitId: p1Visit2.id,
      completedAt: new Date('2026-08-25T16:00:00Z')
    }
  });

  // Partial Payment for Visit 2 (Due: ₹1,800, Paid: ₹1,000 via GPay, Balance: ₹800)
  await prisma.payment.create({
    data: {
      visitId: p1Visit2.id,
      patientId: p1.id,
      amount: 1000,
      method: 'GPay',
      status: 'Completed',
      notes: 'Partial payment — patient requested to pay balance during crown prep',
      date: '2026-08-25',
      createdAt: new Date('2026-08-25T16:15:00Z')
    }
  });

  // =========================================================================
  // PATIENT 2: Ananya Sundaram (2 Visits: Routine Clean + Cancelled Visit)
  // =========================================================================
  const p2 = await prisma.patient.upsert({
    where: { phone: '9791054321' },
    update: {
      address: '22/3 Gandhi Road, Velachery, Chennai',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces'
    },
    create: {
      name: 'Ananya Sundaram',
      phone: '9791054321',
      age: 29,
      gender: 'Female',
      address: '22/3 Gandhi Road, Velachery, Chennai',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces',
      status: 'Active'
    }
  });

  const p2Plan = await prisma.treatmentPlan.upsert({
    where: { patientId: p2.id },
    update: {},
    create: { patientId: p2.id }
  });

  // Visit 1 for Ananya: Full Mouth Scaling (Walk-in)
  const p2Visit1 = await prisma.visit.create({
    data: {
      patientId: p2.id,
      doctorId: dutyDoc.id,
      status: 'COMPLETED',
      amountDue: 1400,
      consultationFee: 300,
      treatmentFee: 1100,
      medicineCost: 0,
      reasonForVisit: 'Bleeding gums and routine scaling',
      createdAt: new Date('2026-09-02T11:00:00Z')
    }
  });

  await prisma.consultation.create({
    data: {
      visitId: p2Visit1.id,
      doctorId: dutyDoc.id,
      reasonForVisit: 'Bleeding gums and routine scaling',
      clinicalNotes: 'Generalized marginal gingivitis. Subgingival calculus present on lingual anterior teeth. Full ultrasonic prophylaxis performed.',
      consultationFee: 300
    }
  });

  await prisma.treatmentPlanItem.create({
    data: {
      treatmentPlanId: p2Plan.id,
      treatmentCatalogId: scaling.id,
      status: 'Completed',
      notes: 'Full mouth supragingival and subgingival scaling with air-polishing.',
      completedVisitId: p2Visit1.id,
      completedAt: new Date('2026-09-02T11:40:00Z')
    }
  });

  // Prescription for Chlorhexidine
  const p2Rx1 = await prisma.prescription.create({
    data: {
      visitId: p2Visit1.id,
      doctorId: dutyDoc.id,
      status: 'Finalized',
      notes: 'Rinse twice daily for 14 days. Do not swallow.'
    }
  });

  await prisma.prescriptionItem.create({
    data: {
      prescriptionId: p2Rx1.id,
      medicineId: hexidine.id,
      quantity: 1,
      dosage: '10ml',
      frequency: 'Twice daily',
      duration: '14 days',
      instructions: 'Swish for 60 seconds after brushing'
    }
  });

  const p2Disp1 = await prisma.dispensing.create({
    data: { visitId: p2Visit1.id, prescriptionId: p2Rx1.id, status: 'Completed' }
  });

  await prisma.dispensingItem.create({
    data: {
      dispensingId: p2Disp1.id,
      medicineId: hexidine.id,
      prescribedQuantity: 1,
      dispensedQuantity: 1
    }
  });

  // Full Payment for Ananya (Cash ₹1,400)
  await prisma.payment.create({
    data: {
      visitId: p2Visit1.id,
      patientId: p2.id,
      amount: 1400,
      method: 'Cash',
      status: 'Completed',
      notes: 'Full payment received at counter',
      date: '2026-09-02',
      createdAt: new Date('2026-09-02T11:50:00Z')
    }
  });

  // Visit 2 for Ananya: Cancelled Appointment Visit with retained deposit
  const p2Appt2 = await prisma.appointment.create({
    data: {
      patientId: p2.id,
      providerId: headDoc.id,
      date: '2026-09-07',
      time: '04:00 PM',
      type: 'Follow-up',
      status: 'Cancelled',
      notes: 'Patient rescheduled due to work travel.'
    }
  });

  const p2Visit2 = await prisma.visit.create({
    data: {
      patientId: p2.id,
      doctorId: headDoc.id,
      appointmentId: p2Appt2.id,
      status: 'CANCELLED',
      amountDue: 500,
      consultationFee: 500,
      reasonForVisit: 'Gingival healing re-evaluation (Cancelled)',
      createdAt: new Date('2026-09-07T16:00:00Z')
    }
  });

  await prisma.payment.create({
    data: {
      visitId: p2Visit2.id,
      patientId: p2.id,
      amount: 500,
      method: 'Credit Card',
      status: 'Completed',
      notes: 'Advance booking retention fee',
      date: '2026-09-07',
      createdAt: new Date('2026-09-07T16:05:00Z')
    }
  });

  // =========================================================================
  // PATIENT 3: Kavitha Venkatesh (New Patient with Planned Treatment only, no visits yet)
  // =========================================================================
  const p3 = await prisma.patient.upsert({
    where: { phone: '9444182736' },
    update: {
      address: 'Plot 18, Lakeview Enclave, Adyar, Chennai',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces'
    },
    create: {
      name: 'Kavitha Venkatesh',
      phone: '9444182736',
      age: 52,
      gender: 'Female',
      address: 'Plot 18, Lakeview Enclave, Adyar, Chennai',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces',
      status: 'Active'
    }
  });

  const p3Plan = await prisma.treatmentPlan.upsert({
    where: { patientId: p3.id },
    update: {},
    create: { patientId: p3.id }
  });

  await prisma.treatmentPlanItem.createMany({
    data: [
      { treatmentPlanId: p3Plan.id, treatmentCatalogId: scaling.id, status: 'Planned', notes: 'Step 1: Oral prophylaxis and plaque removal' },
      { treatmentPlanId: p3Plan.id, treatmentCatalogId: compositeRestoration.id, status: 'Planned', notes: 'Step 2: Cervical abrasions restoration on premolars' }
    ]
  });

  console.log('--- Simulation Data Generated Successfully! ---');
  console.log('1. Rajesh Ramanathan (Phone: 9841029384) -> 2 historical visits, multi-payments, partial payments, multiple doctors, prescriptions, dispensing, and planned crown roadmap.');
  console.log('2. Ananya Sundaram (Phone: 9791054321) -> 2 visits (1 completed scaling with medication + 1 cancelled visit with preserved ledger).');
  console.log('3. Kavitha Venkatesh (Phone: 9444182736) -> Brand new patient with clean "No visit history" empty state and planned treatment roadmap.');
}

seedSimulation().catch(console.error).finally(() => prisma.$disconnect());
