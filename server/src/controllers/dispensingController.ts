import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getPendingDispensing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visits = await prisma.visit.findMany({
      where: {
        status: { in: ['READY_FOR_RECEPTION', 'READY_FOR_PAYMENT'] }
      },
      include: {
        patient: true,
        prescription: {
          include: {
            items: {
              include: { medicine: true }
            }
          }
        },
        dispensing: {
          include: { items: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // We can map it exactly as the frontend wants, or return the standard structure 
    // and let frontend handle it (we shouldn't modify frontend, so we must match the data structure expected by the frontend's API if they were connected. 
    // Since frontend isn't connected yet, returning standard Prisma relational objects is perfect).
    return res.json(visits);
  } catch (error) {
    next(error);
  }
};

export const completeDispensing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { visitId, prescriptionId, items } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const visit = await tx.visit.findUnique({ where: { id: visitId }, include: { dispensing: true, payments: true } });
      if (!visit) throw { status: 404, message: 'Visit not found' };

      if (visit.dispensing) {
        throw { status: 409, message: 'Dispensing already completed for this visit.' };
      }

      const prescription = await tx.prescription.findUnique({
        where: { id: prescriptionId },
        include: { items: true }
      });
      if (!prescription) throw { status: 404, message: 'Prescription not found' };
      if (prescription.visitId !== visitId) throw { status: 409, message: 'Prescription does not match visit' };

      // Ensure all prescription items are accounted for
      const prescriptionItemMap = new Map(prescription.items.map(pi => [pi.medicineId, pi]));
      if (items.length !== prescription.items.length) {
        throw { status: 400, message: 'All prescribed medicines must be accounted for in dispensing submission.' };
      }

      // Validations and Stock Reduction
      let medicineCost = 0;

      for (const item of items) {
        const presItem = prescriptionItemMap.get(item.medicineId);
        if (!presItem) {
          throw { status: 400, message: `Medicine ${item.medicineId} is not part of prescription ${prescriptionId}.` };
        }

        if (item.prescribedQuantity !== presItem.quantity) {
          throw { status: 400, message: `Prescribed quantity mismatch for medicine ${item.medicineId}. Expected ${presItem.quantity}, received ${item.prescribedQuantity}.` };
        }

        if (!Number.isInteger(item.dispensedQuantity) || item.dispensedQuantity < 0) {
          throw { status: 400, message: 'Dispensed quantity must be a non-negative integer.' };
        }

        if (item.dispensedQuantity > presItem.quantity) {
          throw { status: 400, message: `Dispensed quantity cannot exceed prescribed quantity (${presItem.quantity}).` };
        }

        const med = await tx.medicine.findUnique({ where: { id: item.medicineId } });
        if (!med) throw { status: 404, message: `Medicine ${item.medicineId} not found` };

        // Only validate and deduct stock if dispensedQuantity > 0
        if (item.dispensedQuantity > 0) {
          if (item.dispensedQuantity > med.currentStock) {
            throw { status: 409, message: `Insufficient stock for ${med.name}. Requested: ${item.dispensedQuantity}, Available: ${med.currentStock}.` };
          }

          // Deduct Stock
          const newStock = med.currentStock - item.dispensedQuantity;
          await tx.medicine.update({
            where: { id: med.id },
            data: { currentStock: newStock }
          });

          // Log append-only StockMovement for dispensing audit trail
          await tx.stockMovement.create({
            data: {
              medicineId: med.id,
              movementType: 'DISPENSING',
              quantity: -item.dispensedQuantity,
              balanceAfter: newStock,
              referenceType: 'VISIT',
              referenceId: visitId,
              reason: `Dispensed to patient for Visit #${visitId.slice(0, 8)}`,
              performedBy: req.user?.username || req.user?.staff?.name || req.user?.id || 'Staff'
            }
          });

          medicineCost += (item.dispensedQuantity * med.unitPrice);
        }
      }

      // Create Dispensing Records
      const dispensing = await tx.dispensing.create({
        data: {
          visitId,
          prescriptionId,
          status: 'Completed',
          items: {
            create: items.map((i: any) => ({
              medicineId: i.medicineId,
              prescribedQuantity: i.prescribedQuantity,
              dispensedQuantity: i.dispensedQuantity
            }))
          }
        },
        include: { items: true }
      });

      // Transition Visit
      const totalPaid = visit.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
      const finalAmountDue = (visit.consultationFee || 0) + (visit.treatmentFee || 0) + medicineCost;
      const isFullyPaid = visit.paymentOwner === 'DOCTOR' || (totalPaid >= finalAmountDue);

      const nextStatus = isFullyPaid ? 'COMPLETED' : 'READY_FOR_PAYMENT';
      const updatedVisit = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: nextStatus,
          medicineCost,
          amountDue: finalAmountDue
        }
      });

      if (isFullyPaid) {
        const qEntry = await tx.queueEntry.findUnique({ where: { visitId } });
        if (qEntry && qEntry.status !== 'Completed') {
          await tx.queueEntry.update({
            where: { id: qEntry.id },
            data: { status: 'Completed' }
          });
        }
      }

      return { dispensing, visit: updatedVisit };
    });

    return res.json(result);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportDispensing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const format = req.query.format as string;

    const dispensings = await prisma.dispensing.findMany({
      include: {
        items: {
          include: {
            medicine: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const flatData = dispensings.flatMap(d => 
      d.items.map(item => ({
        dispensingId: d.id,
        medicineName: item.medicine.name,
        prescribedQty: item.prescribedQuantity,
        dispensedQty: item.dispensedQuantity,
        status: d.status
      }))
    );

    let filteredData = flatData;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = flatData.filter(d => d.medicineName.toLowerCase().includes(searchLower));
    }

    const columns: ExportColumn[] = [
      { key: 'dispensingId', label: 'Transaction ID' },
      { key: 'medicineName', label: 'Medicine' },
      { key: 'prescribedQty', label: 'Prescribed' },
      { key: 'dispensedQty', label: 'Dispensed' },
      { key: 'status', label: 'Status' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, filteredData);
      res.header('Content-Type', 'text/csv');
      res.attachment('dispensing_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, filteredData, 'Dispensing');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('dispensing_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, filteredData, 'Dispensing Report', `Total Items: ${filteredData.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('dispensing_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};
