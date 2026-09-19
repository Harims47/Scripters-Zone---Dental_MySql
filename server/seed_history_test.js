const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedMultipleHistory() {
  console.log('Seeding rich multi-visit history for Karthieya...');

  const patient = await prisma.patient.findUnique({
    where: { phone: '9623752376' }
  });

  if (!patient) {
    console.error('Patient Karthieya not found!');
    process.exit(1);
  }

  const staffList = await prisma.staff.findMany();
  const drArun = staffList.find(s => s.name === 'Dr. Arun') || staffList[0];
  const drYokesh = staffList.find(s => s.name === 'Dr.Yokesh') || staffList[0];
  const drIrfan = staffList.find(s => s.name === 'Dr.Irfan') || staffList[0];

  const amoxicillin = await prisma.medicine.findFirst({ where: { name: { contains: 'Amoxicillin' } } });
  const ibuprofen = await prisma.medicine.findFirst({ where: { name: { contains: 'Ibuprofen' } } });
  const paracetamol = await prisma.medicine.findFirst({ where: { name: { contains: 'Paracetamol' } } });
  const chlorhexidine = await prisma.medicine.findFirst({ where: { name: { contains: 'Chlorhexidine' } } });

  const scalingCatalog = await prisma.treatmentCatalog.findFirst({ where: { name: { contains: 'Scaling' } } });
  const compositeCatalog = await prisma.treatmentCatalog.findFirst({ where: { name: { contains: 'Composite' } } });
  const extractionCatalog = await prisma.treatmentCatalog.findFirst({ where: { name: { contains: 'Extraction' } } });

  // Ensure TreatmentPlan exists for Karthieya
  let plan = await prisma.treatmentPlan.findUnique({ where: { patientId: patient.id } });
  if (!plan) {
    plan = await prisma.treatmentPlan.create({ data: { patientId: patient.id } });
  }

  // Helper date generators
  const dateVisit1 = new Date('2026-07-15T09:30:00Z');
  const dateVisit2 = new Date('2026-08-02T11:15:00Z');
  const dateVisit3 = new Date('2026-08-20T14:45:00Z');

  // -------------------------------------------------------------
  // VISIT 1: 15 Jul 2026 by Dr. Arun (Routine Checkup & Scaling)
  // -------------------------------------------------------------
  console.log('Creating Historical Visit 1 (15 Jul 2026 - Dr. Arun)...');
  const visit1 = await prisma.visit.create({
    data: {
      patientId: patient.id,
      doctorId: drArun.id,
      status: 'COMPLETED',
      reasonForVisit: 'Routine Checkup',
      consultationFee: 500,
      treatmentFee: 1200,
      medicineCost: 150,
      amountDue: 1850,
      createdAt: dateVisit1,
      updatedAt: dateVisit1,
      consultation: {
        create: {
          doctorId: drArun.id,
          reasonForVisit: 'Routine Checkup',
          clinicalNotes: 'Patient presented for routine annual evaluation. Mild supragingival calculus observed along lower anterior lingual surfaces. Performed full mouth scaling and polishing. Patient advised on twice-daily brushing technique.',
          consultationFee: 500,
          treatmentFee: 1200,
          status: 'Completed',
          createdAt: dateVisit1,
          updatedAt: dateVisit1
        }
      },
      prescription: {
        create: {
          doctorId: drArun.id,
          notes: 'Use mouthwash twice daily after brushing. Do not swallow.',
          status: 'Finalized',
          createdAt: dateVisit1,
          updatedAt: dateVisit1,
          items: {
            create: [
              {
                medicineId: chlorhexidine.id,
                quantity: 1,
                dosage: '10 ml rinse',
                frequency: 'Twice daily',
                duration: '7 days',
                instructions: 'Rinse thoroughly for 60 seconds after meals',
                createdAt: dateVisit1,
                updatedAt: dateVisit1
              }
            ]
          }
        }
      },
      payments: {
        create: [
          {
            patientId: patient.id,
            amount: 1850,
            method: 'GPay',
            status: 'Completed',
            notes: 'UPI payment received at front desk',
            date: '2026-07-15',
            createdAt: dateVisit1,
            updatedAt: dateVisit1
          }
        ]
      }
    },
    include: { prescription: true }
  });

  // Create Dispensing for Visit 1
  await prisma.dispensing.create({
    data: {
      visitId: visit1.id,
      prescriptionId: visit1.prescription.id,
      status: 'Completed',
      createdAt: dateVisit1,
      updatedAt: dateVisit1,
      items: {
        create: [
          {
            medicineId: chlorhexidine.id,
            prescribedQuantity: 1,
            dispensedQuantity: 1,
            createdAt: dateVisit1,
            updatedAt: dateVisit1
          }
        ]
      }
    }
  });

  // Add completed treatment item linked to Visit 1
  if (scalingCatalog) {
    await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: plan.id,
        treatmentCatalogId: scalingCatalog.id,
        status: 'Completed',
        notes: 'Full mouth scaling & ultrasonic polishing completed successfully.',
        completedVisitId: visit1.id,
        completedAt: dateVisit1,
        createdAt: dateVisit1,
        updatedAt: dateVisit1
      }
    });
  }

  // -------------------------------------------------------------
  // VISIT 2: 02 Aug 2026 by Dr. Irfan (Toothache & Composite Filling)
  // Has MULTIPLE payments (Partial Cash + Partial Card)
  // Has Dispensing with Prescribed (10) vs Dispensed (5) difference!
  // -------------------------------------------------------------
  console.log('Creating Historical Visit 2 (02 Aug 2026 - Dr. Irfan)...');
  const visit2 = await prisma.visit.create({
    data: {
      patientId: patient.id,
      doctorId: drIrfan.id,
      status: 'COMPLETED',
      reasonForVisit: 'Toothache',
      consultationFee: 500,
      treatmentFee: 1800,
      medicineCost: 200,
      amountDue: 2500,
      createdAt: dateVisit2,
      updatedAt: dateVisit2,
      consultation: {
        create: {
          doctorId: drIrfan.id,
          reasonForVisit: 'Toothache',
          clinicalNotes: 'Complaints of food lodgement and mild sensitivity to cold in lower right first molar (46). Excavated Class I occlusal caries and placed light-cured composite resin restoration with bonding agent. Occlusion checked and adjusted.',
          consultationFee: 500,
          treatmentFee: 1800,
          status: 'Completed',
          createdAt: dateVisit2,
          updatedAt: dateVisit2
        }
      },
      prescription: {
        create: {
          doctorId: drIrfan.id,
          notes: 'Take pain relief SOS if discomfort persists.',
          status: 'Finalized',
          createdAt: dateVisit2,
          updatedAt: dateVisit2,
          items: {
            create: [
              {
                medicineId: ibuprofen.id,
                quantity: 10,
                dosage: '1 Tablet (400mg)',
                frequency: 'SOS (As needed)',
                duration: '5 days',
                instructions: 'Take after food if pain occurs',
                createdAt: dateVisit2,
                updatedAt: dateVisit2
              },
              {
                medicineId: paracetamol.id,
                quantity: 6,
                dosage: '1 Tablet (500mg)',
                frequency: 'Twice daily',
                duration: '3 days',
                instructions: 'Take with warm water',
                createdAt: dateVisit2,
                updatedAt: dateVisit2
              }
            ]
          }
        }
      },
      payments: {
        create: [
          {
            patientId: patient.id,
            amount: 1500,
            method: 'Cash',
            status: 'Completed',
            notes: 'Initial cash deposit',
            date: '2026-08-02',
            createdAt: dateVisit2,
            updatedAt: dateVisit2
          },
          {
            patientId: patient.id,
            amount: 1000,
            method: 'Debit Card',
            status: 'Completed',
            notes: 'Card payment for remaining balance',
            date: '2026-08-02',
            createdAt: new Date('2026-08-02T12:00:00Z'),
            updatedAt: new Date('2026-08-02T12:00:00Z')
          }
        ]
      }
    },
    include: { prescription: true }
  });

  // Create Dispensing for Visit 2 with prescribed vs dispensed difference
  await prisma.dispensing.create({
    data: {
      visitId: visit2.id,
      prescriptionId: visit2.prescription.id,
      status: 'Completed',
      createdAt: dateVisit2,
      updatedAt: dateVisit2,
      items: {
        create: [
          {
            medicineId: ibuprofen.id,
            prescribedQuantity: 10,
            dispensedQuantity: 6, // Patient only purchased 6 tablets
            createdAt: dateVisit2,
            updatedAt: dateVisit2
          },
          {
            medicineId: paracetamol.id,
            prescribedQuantity: 6,
            dispensedQuantity: 6,
            createdAt: dateVisit2,
            updatedAt: dateVisit2
          }
        ]
      }
    }
  });

  if (compositeCatalog) {
    await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: plan.id,
        treatmentCatalogId: compositeCatalog.id,
        status: 'Completed',
        notes: 'Class I tooth-colored composite restoration on tooth #46.',
        completedVisitId: visit2.id,
        completedAt: dateVisit2,
        createdAt: dateVisit2,
        updatedAt: dateVisit2
      }
    });
  }

  // -------------------------------------------------------------
  // VISIT 3: 20 Aug 2026 by Dr. Yokesh (Follow-up)
  // -------------------------------------------------------------
  console.log('Creating Historical Visit 3 (20 Aug 2026 - Dr. Yokesh)...');
  const visit3 = await prisma.visit.create({
    data: {
      patientId: patient.id,
      doctorId: drYokesh.id,
      status: 'COMPLETED',
      reasonForVisit: 'Follow-up',
      consultationFee: 300,
      treatmentFee: 0,
      medicineCost: 0,
      amountDue: 300,
      createdAt: dateVisit3,
      updatedAt: dateVisit3,
      consultation: {
        create: {
          doctorId: drYokesh.id,
          reasonForVisit: 'Follow-up',
          clinicalNotes: 'Post-restoration review. Restoration is intact, margins well-adapted, sensitivity completely subsided. Patient has no complaints.',
          consultationFee: 300,
          treatmentFee: 0,
          status: 'Completed',
          createdAt: dateVisit3,
          updatedAt: dateVisit3
        }
      },
      payments: {
        create: [
          {
            patientId: patient.id,
            amount: 300,
            method: 'Cash',
            status: 'Completed',
            notes: 'Follow-up check fee',
            date: '2026-08-20',
            createdAt: dateVisit3,
            updatedAt: dateVisit3
          }
        ]
      }
    }
  });

  // -------------------------------------------------------------
  // ACTIVE VISIT TODAY for Karthieya: In Queue / With Doctor (Waiting / In Progress)
  // So the doctor can open Doctor Workspace right now!
  // -------------------------------------------------------------
  console.log('Creating Active Visit for Karthieya today...');
  const todayNow = new Date();
  const activeVisit = await prisma.visit.create({
    data: {
      patientId: patient.id,
      doctorId: drArun.id,
      status: 'WITH_DOCTOR',
      reasonForVisit: 'Surgery',
      amountDue: 1500,
      consultationFee: 500,
      createdAt: todayNow,
      updatedAt: todayNow,
      queueEntry: {
        create: {
          patientId: patient.id,
          assignedDoctorId: drArun.id,
          status: 'In Progress',
          position: 1,
          priority: false,
          arrivalTime: todayNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: todayNow,
          updatedAt: todayNow
        }
      }
    }
  });

  console.log('Successfully seeded rich history!');
  console.log(`Active Visit ID: ${activeVisit.id}`);
  console.log(`Doctor Workspace URL: http://localhost:5173/doctor-workspace/${patient.id}?visitId=${activeVisit.id}`);
  await pool.end();
}

seedMultipleHistory().catch(err => {
  console.error(err);
  process.exit(1);
});
