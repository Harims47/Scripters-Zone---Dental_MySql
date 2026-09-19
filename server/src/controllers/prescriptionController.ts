import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const upsertPrescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { visitId, notes, items } = req.body;
    const doctorId = (req as any).user.staffId;

    if (!doctorId) {
      return res.status(403).json({ error: 'Authenticated user is not linked to a staff record' });
    }

    const visit = await prisma.visit.findUnique({ where: { id: visitId }, include: { prescription: true } });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    if (visit.status !== 'WITH_DOCTOR') {
      return res.status(409).json({ error: 'Visit is not in WITH_DOCTOR state' });
    }

    // Verify all medicines exist, are Active, and calculate cost
    for (const item of items) {
      const med = await prisma.medicine.findUnique({ where: { id: item.medicineId } });
      if (!med) return res.status(400).json({ error: `Medicine ID ${item.medicineId} not found` });
      if (med.status === 'Inactive') {
        return res.status(400).json({ error: `Cannot prescribe inactive medicine "${med.name}". Please choose an active medicine.` });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let prescriptionId = visit.prescription?.id;

      if (visit.prescription) {
        if (visit.prescription.doctorId !== doctorId) {
          throw { status: 403, message: 'You are not the owner of this prescription' };
        }
        if (visit.prescription.status !== 'Draft') {
          throw { status: 409, message: 'Cannot edit a finalized or dispensed prescription' };
        }
        
        // Update prescription and replace items
        await tx.prescription.update({
          where: { id: prescriptionId },
          data: { notes: notes || '' }
        });

        await tx.prescriptionItem.deleteMany({ where: { prescriptionId } });

      } else {
        // Create new
        const newPrescription = await tx.prescription.create({
          data: {
            visitId,
            doctorId,
            notes: notes || '',
            status: 'Draft'
          }
        });
        prescriptionId = newPrescription.id;
      }

      // Create items
      if (items.length > 0) {
        const createItems = items.map((i: any) => ({
          prescriptionId,
          medicineId: i.medicineId,
          quantity: i.quantity,
          dosage: i.dosage || null,
          frequency: i.frequency || null,
          duration: i.duration || null,
          instructions: i.instructions || ''
        }));

        await tx.prescriptionItem.createMany({
          data: createItems
        });
      }

      return tx.prescription.findUnique({
        where: { id: prescriptionId },
        include: { items: true }
      });
    });

    return res.status(visit.prescription ? 200 : 201).json(result);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};
