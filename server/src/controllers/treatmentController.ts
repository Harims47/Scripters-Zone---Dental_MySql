import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

// Valid 32 permanent adult teeth in FDI notation (ISO 3950)
export const VALID_FDI_NUMBERS = new Set([
  // Maxillary / Upper: 18..11 (UR) and 21..28 (UL)
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
  // Mandibular / Lower: 48..41 (LR) and 31..38 (LL)
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
]);

export const getTreatmentCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const catalog = await prisma.treatmentCatalog.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
        { variant: 'asc' }
      ]
    });
    return res.json(catalog);
  } catch (error) {
    next(error);
  }
};

export const getPatientTreatmentPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.patientId as string;
    
    // Ensure patient exists
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    let plan = await prisma.treatmentPlan.findUnique({
      where: { patientId },
      include: {
        items: {
          include: { catalogItem: true, completedVisit: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!plan) {
      plan = await prisma.treatmentPlan.create({
        data: { patientId },
        include: { items: { include: { catalogItem: true, completedVisit: true } } }
      });
    }

    return res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const addTreatmentPlanItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.patientId as string;
    const { treatmentCatalogId, toothNumber, toothNumbers, notes, completedVisitId, status } = req.body;

    // 1. Validation: Cannot provide both toothNumber and toothNumbers simultaneously
    if (toothNumber !== undefined && toothNumbers !== undefined) {
      return res.status(400).json({ error: 'Cannot provide both toothNumber and toothNumbers simultaneously' });
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const catalogItem = await prisma.treatmentCatalog.findUnique({ where: { id: treatmentCatalogId } });
    if (!catalogItem) return res.status(404).json({ error: 'Catalog item not found' });

    let plan = await prisma.treatmentPlan.findUnique({ where: { patientId } });
    if (!plan) {
      plan = await prisma.treatmentPlan.create({ data: { patientId } });
    }

    const targetStatus = status || (completedVisitId ? 'Completed' : 'Planned');

    // 2. Multi-tooth creation
    if (toothNumbers !== undefined && toothNumbers !== null) {
      if (!Array.isArray(toothNumbers) || toothNumbers.length === 0) {
        return res.status(400).json({ error: 'toothNumbers must be a non-empty array of numbers' });
      }

      // Check uniqueness
      const uniqueTeeth = Array.from(new Set(toothNumbers));
      if (uniqueTeeth.length !== toothNumbers.length) {
        return res.status(400).json({ error: 'Duplicate tooth numbers are not permitted in toothNumbers' });
      }

      // Validate each FDI number
      for (const t of toothNumbers) {
        if (typeof t !== 'number' || !Number.isInteger(t) || !VALID_FDI_NUMBERS.has(t)) {
          return res.status(400).json({ error: `Invalid FDI tooth number: ${t}` });
        }
      }

      // Execute transactionally
      const createdItems = await prisma.$transaction(async (tx) => {
        const items = [];
        for (const t of toothNumbers) {
          const item = await tx.treatmentPlanItem.create({
            data: {
              treatmentPlanId: plan.id,
              treatmentCatalogId,
              toothNumber: t,
              notes: notes || null,
              status: targetStatus,
              completedVisitId: completedVisitId || null,
              completedAt: completedVisitId ? new Date() : null,
            },
            include: { catalogItem: true, completedVisit: true }
          });
          items.push(item);
        }
        return items;
      });

      return res.status(201).json(createdItems);
    }

    // 3. Single-tooth (or general non-tooth) creation
    let validatedToothNumber: number | null = null;
    if (toothNumber !== undefined && toothNumber !== null) {
      if (typeof toothNumber !== 'number' || !Number.isInteger(toothNumber) || !VALID_FDI_NUMBERS.has(toothNumber)) {
        return res.status(400).json({ error: `Invalid FDI tooth number: ${toothNumber}` });
      }
      validatedToothNumber = toothNumber;
    }

    const item = await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: plan.id,
        treatmentCatalogId,
        toothNumber: validatedToothNumber,
        notes: notes || null,
        status: targetStatus,
        completedVisitId: completedVisitId || null,
        completedAt: completedVisitId ? new Date() : null,
      },
      include: { catalogItem: true, completedVisit: true }
    });

    return res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const updateTreatmentPlanItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.patientId as string;
    const itemId = req.params.itemId as string;
    const { status, completedVisitId, notes, toothNumber, treatmentCatalogId } = req.body;

    const item = await prisma.treatmentPlanItem.findUnique({
      where: { id: itemId },
      include: { treatmentPlan: true }
    });

    if (!item) return res.status(404).json({ error: 'Treatment plan item not found' });
    if (item.treatmentPlan.patientId !== patientId) {
      return res.status(400).json({ error: 'Item does not belong to this patient' });
    }

    // Preservation of clinical completion semantics:
    // Do not permit altering tooth assignment or procedure on a finalized historical clinical visit
    const completedVisit = item.completedVisitId
      ? await prisma.visit.findUnique({ where: { id: item.completedVisitId } })
      : null;
    const isClosedHistoricalVisit = item.status === 'Completed' && completedVisit?.status === 'COMPLETED';
    const isLockedCompleted = item.status === 'Completed' && (!completedVisit || isClosedHistoricalVisit);

    if (isLockedCompleted) {
      if (toothNumber !== undefined && toothNumber !== item.toothNumber) {
        return res.status(400).json({ error: 'Cannot modify tooth assignment on a completed clinical procedure' });
      }
      if (treatmentCatalogId !== undefined && treatmentCatalogId !== item.treatmentCatalogId) {
        return res.status(400).json({ error: 'Cannot modify procedure on a completed clinical procedure' });
      }
    }

    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;

    // Allow updating procedure on Planned items or items in an active/non-finalized visit
    if (treatmentCatalogId !== undefined && !isClosedHistoricalVisit) {
      const catalogItem = await prisma.treatmentCatalog.findUnique({ where: { id: treatmentCatalogId } });
      if (!catalogItem) return res.status(404).json({ error: 'Catalog item not found' });
      updateData.treatmentCatalogId = treatmentCatalogId;
    }

    // Allow updating toothNumber on Planned items or items in an active/non-finalized visit
    if (toothNumber !== undefined && !isClosedHistoricalVisit) {
      if (toothNumber !== null) {
        if (typeof toothNumber !== 'number' || !Number.isInteger(toothNumber) || !VALID_FDI_NUMBERS.has(toothNumber)) {
          return res.status(400).json({ error: `Invalid FDI tooth number: ${toothNumber}` });
        }
      }
      updateData.toothNumber = toothNumber;
    }

    if (status === 'Completed') {
      if (!completedVisitId && !item.completedVisitId) {
        return res.status(400).json({ error: 'completedVisitId is required when marking as Completed' });
      }

      const targetVisitId = completedVisitId || item.completedVisitId;
      const visit = await prisma.visit.findUnique({ where: { id: targetVisitId! } });
      if (!visit) return res.status(404).json({ error: 'Visit not found' });
      if (visit.patientId !== patientId) {
        return res.status(400).json({ error: 'Visit does not belong to this patient' });
      }

      updateData.status = 'Completed';
      updateData.completedVisitId = targetVisitId;
      updateData.completedAt = item.completedAt || new Date();
    } else if (status === 'Planned') {
      updateData.status = 'Planned';
      updateData.completedVisitId = null;
      updateData.completedAt = null;
    }

    const updatedItem = await prisma.treatmentPlanItem.update({
      where: { id: itemId },
      data: updateData,
      include: { catalogItem: true, completedVisit: true }
    });

    return res.json(updatedItem);
  } catch (error) {
    next(error);
  }
};

export const deleteTreatmentPlanItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.patientId as string;
    const itemId = req.params.itemId as string;

    const item = await prisma.treatmentPlanItem.findUnique({
      where: { id: itemId },
      include: { treatmentPlan: true }
    });

    if (!item) return res.status(404).json({ error: 'Treatment plan item not found' });
    if (item.treatmentPlan.patientId !== patientId) {
      return res.status(400).json({ error: 'Item does not belong to this patient' });
    }

    await prisma.treatmentPlanItem.delete({ where: { id: itemId } });
    return res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    next(error);
  }
};
