import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getConsultationByVisitId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visitId = req.params.visitId as string;
    const consultation = await prisma.consultation.findUnique({
      where: { visitId }
    });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found for this visit' });
    return res.json(consultation);
  } catch (error) {
    next(error);
  }
};

export const createConsultation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { visitId, reasonForVisit, clinicalNotes, consultationFee, treatmentFee } = req.body;
    const doctorId = (req as any).user.staffId;

    if (!doctorId) {
      return res.status(403).json({ error: 'Authenticated user is not linked to a staff record' });
    }

    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    if (visit.status !== 'WITH_DOCTOR') {
      return res.status(409).json({ error: 'Visit is not in WITH_DOCTOR state' });
    }

    if (consultationFee !== undefined && consultationFee < 0) {
      return res.status(400).json({ error: 'Consultation fee cannot be negative' });
    }
    if (treatmentFee !== undefined && treatmentFee < 0) {
      return res.status(400).json({ error: 'Treatment fee cannot be negative' });
    }

    // Check for duplicate consultation
    const existing = await prisma.consultation.findUnique({ where: { visitId } });
    if (existing) {
      return res.status(409).json({ error: 'Consultation already exists for this visit' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.create({
        data: {
          visitId,
          doctorId,
          reasonForVisit,
          clinicalNotes,
          consultationFee: consultationFee || 0,
          treatmentFee: treatmentFee || 0,
          status: 'In Progress'
        }
      });

      // Link to Visit
      await tx.visit.update({
        where: { id: visitId },
        data: { 
          consultationFee: consultationFee || 0,
          treatmentFee: treatmentFee || 0,
          amountDue: (consultationFee || 0) + (treatmentFee || 0) + (visit.medicineCost || 0)
        }
      });

      return consultation;
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateConsultation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { reasonForVisit, clinicalNotes, consultationFee, treatmentFee } = req.body;
    const doctorId = (req as any).user.staffId;

    const existing = await prisma.consultation.findUnique({ where: { id }, include: { visit: true } });
    if (!existing) return res.status(404).json({ error: 'Consultation not found' });

    if (existing.doctorId !== doctorId) {
      return res.status(403).json({ error: 'You are not the owner of this consultation' });
    }

    if (existing.status === 'Completed') {
      return res.status(409).json({ error: 'Cannot edit a completed consultation' });
    }

    if (consultationFee !== undefined && consultationFee < 0) {
      return res.status(400).json({ error: 'Consultation fee cannot be negative' });
    }
    if (treatmentFee !== undefined && treatmentFee < 0) {
      return res.status(400).json({ error: 'Treatment fee cannot be negative' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.update({
        where: { id },
        data: { reasonForVisit, clinicalNotes, consultationFee, treatmentFee }
      });

      if (consultationFee !== undefined || treatmentFee !== undefined) {
        const finalConsultationFee = consultationFee !== undefined ? consultationFee : existing.consultationFee;
        const finalTreatmentFee = treatmentFee !== undefined ? treatmentFee : existing.treatmentFee;

        await tx.visit.update({
          where: { id: existing.visitId },
          data: {
            consultationFee: finalConsultationFee,
            treatmentFee: finalTreatmentFee,
            amountDue: finalConsultationFee + (finalTreatmentFee || 0) + (existing.visit.medicineCost || 0)
          }
        });
      }

      return consultation;
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const completeConsultation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visitId = req.params.visitId as string;
    const doctorId = (req as any).user.staffId;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { consultation: true, prescription: { include: { items: true } }, queueEntry: true }
    });

    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    if (visit.status !== 'WITH_DOCTOR') {
      return res.status(409).json({ error: 'Visit is not in WITH_DOCTOR state' });
    }

    if (!visit.consultation) {
      return res.status(409).json({ error: 'Cannot complete visit without a consultation' });
    }

    // Check doctor ownership (Head Doctor can complete any consultation; Duty Doctor must own it)
    if (req.user?.role === 'Duty Doctor' && visit.consultation.doctorId !== doctorId) {
      return res.status(403).json({ error: 'You are not the doctor for this consultation' });
    }

    const rawPaymentOwner = req.body?.paymentOwner;
    if (rawPaymentOwner && rawPaymentOwner !== 'RECEPTION' && rawPaymentOwner !== 'DOCTOR') {
      return res.status(400).json({ error: 'paymentOwner must be either RECEPTION or DOCTOR' });
    }
    const paymentOwner = rawPaymentOwner === 'DOCTOR' ? 'DOCTOR' : 'RECEPTION';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Finalize Consultation
      await tx.consultation.update({
        where: { id: visit.consultation!.id },
        data: { status: 'Completed' }
      });

      // 2. Finalize Prescription if exists
      if (visit.prescription) {
        await tx.prescription.update({
          where: { id: visit.prescription.id },
          data: { status: 'Finalized' }
        });
      }

      // 3. Compute accurate medicine cost from prescription items
      let medCost = visit.medicineCost || 0;
      if (visit.prescription?.items && visit.prescription.items.length > 0) {
        const medIds = visit.prescription.items.map((i: any) => i.medicineId);
        const meds = await tx.medicine.findMany({ where: { id: { in: medIds } } });
        medCost = visit.prescription.items.reduce((sum: number, item: any) => {
          const m = meds.find(med => med.id === item.medicineId);
          return sum + (item.quantity * (m?.unitPrice || 0));
        }, 0);
      }
      const finalAmountDue = (visit.consultationFee || 0) + (visit.treatmentFee || 0) + medCost;

      // 4. Transition Visit atomically with paymentOwner, medicineCost, and amountDue
      const updatedVisit = await tx.visit.update({
        where: { id: visitId },
        data: { 
          status: 'READY_FOR_RECEPTION',
          paymentOwner,
          medicineCost: medCost,
          amountDue: finalAmountDue
        }
      });

      // 4. Transition Queue
      if (visit.queueEntry) {
        await tx.queueEntry.update({
          where: { id: visit.queueEntry.id },
          data: { status: 'Ready at Reception' }
        });
      }

      return updatedVisit;
    });

    // Asynchronously queue digital prescription notification if prescription exists
    if (visit.prescription) {
      const { NotificationService } = await import('../services/communication/NotificationService');
      NotificationService.requestNotification({
        type: 'PRESCRIPTION',
        patientId: visit.patientId,
        entityType: 'VISIT',
        entityId: visit.id,
        variables: {
          doctorName: req.user?.username || 'Doctor',
          date: new Date().toLocaleDateString('en-IN'),
        },
      }).catch((err) => console.error('[Notification] Failed to queue prescription notification:', err.message));
    }

    return res.json({ message: 'Consultation completed successfully', visit: result });
  } catch (error) {
    next(error);
  }
};
