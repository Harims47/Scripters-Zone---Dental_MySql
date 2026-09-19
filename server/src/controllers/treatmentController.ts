import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

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
    const { treatmentCatalogId, notes, completedVisitId } = req.body;

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const catalogItem = await prisma.treatmentCatalog.findUnique({ where: { id: treatmentCatalogId } });
    if (!catalogItem) return res.status(404).json({ error: 'Catalog item not found' });

    let plan = await prisma.treatmentPlan.findUnique({ where: { patientId } });
    if (!plan) {
      plan = await prisma.treatmentPlan.create({ data: { patientId } });
    }

    const item = await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: plan.id,
        treatmentCatalogId,
        notes,
        status: 'Completed',
        completedVisitId: completedVisitId || null,
        completedAt: completedVisitId ? new Date() : new Date(),
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
    const { status, completedVisitId, notes } = req.body;

    const item = await prisma.treatmentPlanItem.findUnique({
      where: { id: itemId },
      include: { treatmentPlan: true }
    });

    if (!item) return res.status(404).json({ error: 'Treatment plan item not found' });
    if (item.treatmentPlan.patientId !== patientId) {
      return res.status(400).json({ error: 'Item does not belong to this patient' });
    }

    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;

    if (status === 'Completed') {
      if (!completedVisitId) {
        return res.status(400).json({ error: 'completedVisitId is required when marking as Completed' });
      }

      // Check visit ownership and authorization
      const visit = await prisma.visit.findUnique({ where: { id: completedVisitId } });
      if (!visit) return res.status(404).json({ error: 'Visit not found' });
      if (visit.patientId !== patientId) {
        return res.status(400).json({ error: 'Visit does not belong to this patient' });
      }

      updateData.status = 'Completed';
      updateData.completedVisitId = completedVisitId;
      updateData.completedAt = new Date();
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
