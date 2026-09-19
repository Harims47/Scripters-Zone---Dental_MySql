import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getPatientHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.patientId as string;

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        treatmentPlan: {
          include: {
            items: {
              include: {
                catalogItem: true,
                completedVisit: true
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Fetch ALL historical visits for the patient (newest first)
    // Includes cancelled, active, and completed visits as required by Phase A
    const visits = await prisma.visit.findMany({
      where: { patientId },
      include: {
        appointment: true,
        consultation: true,
        prescription: {
          include: { items: { include: { medicine: true } } }
        },
        dispensing: {
          include: { items: { include: { medicine: true } } }
        },
        completedTreatmentItems: {
          include: { catalogItem: true }
        },
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Sort visits chronologically by clinical date (using visitDate when present, fallback to createdAt)
    visits.sort((a, b) => {
      const dateA = a.visitDate ? new Date(a.visitDate).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.visitDate ? new Date(b.visitDate).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    // Lookup staff/doctor details for visits where doctorId is present
    const doctorIds = Array.from(new Set(visits.map(v => v.doctorId).filter(Boolean))) as string[];
    const doctors = await prisma.staff.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, name: true, role: true }
    });
    const doctorMap = new Map<string, { id: string; name: string; role: string }>();
    doctors.forEach(d => doctorMap.set(d.id, d));

    // Format visits with authoritative financial summary and doctor info
    const formattedVisits = visits.map(v => {
      const doctor = v.doctorId ? doctorMap.get(v.doctorId) || null : null;
      
      // Calculate financial summary from authoritative visit and payment records
      // Notice: every payment row is preserved in v.payments
      const totalPaid = v.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const expectedAmount = v.amountDue || 0;
      const balance = Math.max(0, expectedAmount - totalPaid);
      
      let financialStatus: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
      if (expectedAmount === 0 && totalPaid === 0) {
        financialStatus = 'Paid';
      } else if (balance === 0 && totalPaid > 0) {
        financialStatus = 'Paid';
      } else if (totalPaid > 0 && balance > 0) {
        financialStatus = 'Partial';
      } else {
        financialStatus = 'Unpaid';
      }

      return {
        ...v,
        doctor,
        financialSummary: {
          amountDue: expectedAmount,
          totalPaid,
          balance,
          status: financialStatus,
          consultationFee: v.consultationFee || 0,
          treatmentFee: v.treatmentFee || 0,
          medicineCost: v.medicineCost || 0
        }
      };
    });

    return res.json({
      patient: {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        status: patient.status,
        photoUrl: patient.photoUrl,
        address: patient.address,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt
      },
      treatmentPlan: patient.treatmentPlan || null,
      visits: formattedVisits
    });
  } catch (error) {
    next(error);
  }
};

export const getHistoricalVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.patientId as string;
    const visitId = req.params.visitId as string;

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        appointment: true,
        consultation: true,
        prescription: {
          include: { items: { include: { medicine: true } } }
        },
        dispensing: {
          include: { items: { include: { medicine: true } } }
        },
        completedTreatmentItems: {
          include: { catalogItem: true }
        },
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    
    // Isolation Check
    if (visit.patientId !== patientId) {
      return res.status(404).json({ error: 'Visit does not belong to this patient' });
    }

    let doctor: { id: string; name: string; role: string } | null = null;
    if (visit.doctorId) {
      const doc = await prisma.staff.findUnique({
        where: { id: visit.doctorId },
        select: { id: true, name: true, role: true }
      });
      if (doc) doctor = doc;
    }

    const totalPaid = visit.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const expectedAmount = visit.amountDue || 0;
    const balance = Math.max(0, expectedAmount - totalPaid);
    
    let financialStatus: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
    if (expectedAmount === 0 && totalPaid === 0) {
      financialStatus = 'Paid';
    } else if (balance === 0 && totalPaid > 0) {
      financialStatus = 'Paid';
    } else if (totalPaid > 0 && balance > 0) {
      financialStatus = 'Partial';
    } else {
      financialStatus = 'Unpaid';
    }

    return res.json({
      ...visit,
      doctor,
      financialSummary: {
        amountDue: expectedAmount,
        totalPaid,
        balance,
        status: financialStatus,
        consultationFee: visit.consultationFee || 0,
        treatmentFee: visit.treatmentFee || 0,
        medicineCost: visit.medicineCost || 0
      }
    });
  } catch (error) {
    next(error);
  }
};
