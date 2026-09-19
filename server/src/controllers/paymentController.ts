import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const method = req.query.method as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (req.user?.role === 'Receptionist') {
      where.visit = { paymentOwner: { not: 'DOCTOR' } };
    }
    if (method && method !== 'all') {
      where.method = method;
    }
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { patient: { name: { contains: search } } }
      ];
    }

    const [payments, totalRecords] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: { patient: true, visit: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    return res.json({
      data: payments,
      meta: {
        currentPage: page,
        pageSize: limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id as string },
      include: { patient: true, visit: true }
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (req.user?.role === 'Receptionist' && payment.visit?.paymentOwner === 'DOCTOR') {
      return res.status(403).json({ error: 'Access denied: Payment is handled by Doctor.' });
    }

    return res.json(payment);
  } catch (error) {
    next(error);
  }
};

export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { visitId, amount, method, notes, isFinalPayment } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Lock the visit row to prevent concurrent partial payment races
      await tx.$executeRaw`SELECT 1 FROM \`Visit\` WHERE id = ${visitId} FOR UPDATE`;

      const visit = await tx.visit.findUnique({
        where: { id: visitId },
        include: { 
          patient: true, 
          payments: true, 
          prescription: { include: { items: true } },
          dispensing: true 
        }
      });

      if (!visit) throw { status: 404, message: 'Visit not found' };

      const userRole = req.user?.role;
      const userStaffId = req.user?.staffId;

      // Ownership-based authorization
      if (userRole === 'Receptionist') {
        if (visit.paymentOwner === 'DOCTOR') {
          throw { status: 403, message: 'Payment for this visit is handled by the doctor.' };
        }
      } else if (userRole === 'Duty Doctor') {
        if (visit.paymentOwner !== 'DOCTOR') {
          throw { status: 403, message: 'Payment for this visit is handled by Reception Desk.' };
        }
        if (visit.doctorId && visit.doctorId !== userStaffId) {
          throw { status: 403, message: 'You are not authorized to collect payment for another doctor\'s patient.' };
        }
      }
      // Note: Head Doctor has authority across all visits

      let expectedAmount = visit.amountDue || 0;
      // If medicineCost is not yet computed, but prescription has items, compute and persist
      if ((!visit.medicineCost || visit.medicineCost === 0) && visit.prescription?.items?.length) {
        const medIds = visit.prescription.items.map((i: any) => i.medicineId);
        const meds = await tx.medicine.findMany({ where: { id: { in: medIds } } });
        const medCost = visit.prescription.items.reduce((sum: number, item: any) => {
          const m = meds.find(med => med.id === item.medicineId);
          return sum + (item.quantity * (m?.unitPrice || 0));
        }, 0);
        if (medCost > 0) {
          expectedAmount = (visit.consultationFee || 0) + (visit.treatmentFee || 0) + medCost;
          await tx.visit.update({
            where: { id: visit.id },
            data: { medicineCost: medCost, amountDue: expectedAmount }
          });
        }
      }

      const totalPaid = visit.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      const balance = expectedAmount - totalPaid;

      if (visit.status === 'COMPLETED' || balance <= 0) {
        throw { status: 409, message: 'Payment already completed for this visit.' };
      }

      // Check state readiness
      const isDoctorHandling = visit.paymentOwner === 'DOCTOR';
      if (isDoctorHandling && (userRole === 'Duty Doctor' || userRole === 'Head Doctor')) {
        // Allowed in WITH_DOCTOR, READY_FOR_RECEPTION, or READY_FOR_PAYMENT
        if (!['WITH_DOCTOR', 'READY_FOR_RECEPTION', 'READY_FOR_PAYMENT'].includes(visit.status)) {
          throw { status: 409, message: `Cannot process payment for visit in status: ${visit.status}` };
        }
      } else {
        if (visit.status === 'READY_FOR_RECEPTION') {
          // If there's a prescription but no dispensing, it's not ready
          if (visit.prescription) {
            const disp = await tx.dispensing.findUnique({ where: { visitId } });
            if (!disp) {
              throw { status: 409, message: 'Visit requires dispensing before payment can be collected.' };
            }
          }
        } else if (visit.status !== 'READY_FOR_PAYMENT') {
          throw { status: 409, message: `Cannot process payment for visit in status: ${visit.status}` };
        }
      }

      if (amount <= 0) {
        throw { status: 400, message: 'Payment amount must be greater than zero.' };
      }

      if (amount > balance) {
        throw { status: 400, message: `Payment amount (₹${amount}) exceeds remaining balance (₹${balance}).` };
      }

      const isPartial = amount < balance;

      // Partial payment authoritative validation
      if (isPartial) {
        const trimmedNotes = notes ? notes.trim() : '';
        if (!trimmedNotes) {
          throw { status: 400, message: 'A reason is required for partial payment.' };
        }
        if (trimmedNotes.toLowerCase() === 'other' || trimmedNotes.toLowerCase() === 'other:') {
          throw { status: 400, message: 'Please provide an explanation when selecting Other.' };
        }
        if (trimmedNotes.toLowerCase().startsWith('other:') && !trimmedNotes.slice(6).trim()) {
          throw { status: 400, message: 'Please provide an explanation when selecting Other.' };
        }
      }

      // Create Payment
      const payment = await tx.payment.create({
        data: {
          visitId: visit.id,
          patientId: visit.patientId,
          amount,
          method,
          notes: notes ? notes.trim() : undefined,
          status: 'Completed',
          date: new Date().toISOString()
        }
      });

      let updatedVisit: any = visit;
      const newBalance = balance - amount;
      
      // A partial payment must NOT complete the visit.
      // Only when the authoritative backend balance becomes exactly 0 does the visit complete.
      if (newBalance === 0) {
        // Check if there is a prescription with items that still requires dispensing
        const hasPendingDispensing = (visit.prescription?.items?.length ?? 0) > 0 && !visit.dispensing;

        if (hasPendingDispensing) {
          // Keep visit in READY_FOR_RECEPTION so Reception can dispense medicines
          updatedVisit = await tx.visit.update({
            where: { id: visit.id },
            data: { status: 'READY_FOR_RECEPTION' },
            include: { patient: true, payments: true, prescription: true, dispensing: true }
          });

          const qEntry = await tx.queueEntry.findUnique({ where: { visitId: visit.id } });
          if (qEntry && qEntry.status !== 'Ready at Reception') {
            await tx.queueEntry.update({
              where: { id: qEntry.id },
              data: { status: 'Ready at Reception' }
            });
          }
        } else {
          updatedVisit = await tx.visit.update({
            where: { id: visit.id },
            data: { status: 'COMPLETED' },
            include: { patient: true, payments: true, prescription: true, dispensing: true }
          });
          
          // Ensure QueueEntry is marked Completed
          const qEntry = await tx.queueEntry.findUnique({ where: { visitId: visit.id } });
          if (qEntry && qEntry.status !== 'Completed') {
            await tx.queueEntry.update({
              where: { id: qEntry.id },
              data: { status: 'Completed' }
            });
          }
        }
      }

      return { payment, visit: updatedVisit };
    });

    // Asynchronously queue payment receipt notification
    const { NotificationService } = await import('../services/communication/NotificationService');
    NotificationService.requestNotification({
      type: 'PAYMENT_RECEIPT',
      patientId: result.payment.patientId,
      entityType: 'PAYMENT',
      entityId: result.payment.id,
      paymentOwner: result.visit.paymentOwner,
      variables: {
        amount: result.payment.amount,
        paymentMethod: result.payment.method,
        receiptNumber: `RCPT-${result.payment.id.substring(0, 8).toUpperCase()}`,
        date: new Date(result.payment.date).toLocaleDateString('en-IN'),
      },
    }).catch((err) => console.error('[Notification] Failed to queue payment receipt:', err.message));

    // Record non-repudiable business audit event strictly AFTER transaction commits
    const { recordAuditEvent } = await import('../utils/auditLogger');
    await recordAuditEvent({
      action: 'PAYMENT_RECORDED',
      entityType: 'Payment',
      entityId: result.payment.id,
      actorId: req.user?.id,
      actorRole: req.user?.role,
      ipAddress: req.ip,
      metadata: {
        amount: result.payment.amount,
        method: result.payment.method,
        visitId: result.payment.visitId,
        isPartial: Boolean(req.body.isPartial ?? (result.payment.amount < result.visit.amountDue)),
      }
    });

    return res.status(201).json(result);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const method = req.query.method as string;
    const format = req.query.format as string;

    const where: any = {};
    if (req.user?.role === 'Receptionist') {
      where.visit = { paymentOwner: { not: 'DOCTOR' } };
    }
    if (method && method !== 'all') {
      where.method = method;
    }
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { patient: { name: { contains: search } } }
      ];
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { patient: true },
      orderBy: { createdAt: 'desc' }
    });

    const formattedData = payments.map(p => ({
      id: p.id,
      patientName: p.patient?.name || 'Unknown',
      amount: p.amount,
      method: p.method,
      status: p.status,
      date: p.date
    }));

    const columns: ExportColumn[] = [
      { key: 'id', label: 'Payment ID' },
      { key: 'patientName', label: 'Patient Name' },
      { key: 'amount', label: 'Amount' },
      { key: 'method', label: 'Method' },
      { key: 'status', label: 'Status' },
      { key: 'date', label: 'Date' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, formattedData);
      res.header('Content-Type', 'text/csv');
      res.attachment('payments_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, formattedData, 'Payments');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('payments_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, formattedData, 'Payments Report', `Total Records: ${formattedData.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('payments_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};

export const exportPartialPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const overdueFilter = req.query.overdue as string; // 'all' | 'overdue' | 'normal'
    const format = req.query.format as string;

    const whereVisits: any = { status: { not: 'CANCELLED' } };
    if (req.user?.role === 'Receptionist') {
      whereVisits.paymentOwner = { not: 'DOCTOR' };
    }

    const visits = await prisma.visit.findMany({
      where: whereVisits,
      include: {
        patient: true,
        payments: true
      }
    });

    const staffMembers = await prisma.staff.findMany();
    const staffMap = new Map(staffMembers.map(s => [s.id, s.name]));

    const alertData: any[] = [];
    for (const v of visits) {
      const vPayments = v.payments || [];
      if (vPayments.length > 0) {
        const totalPaid = vPayments.reduce((sum, p) => sum + p.amount, 0);
        const amountDue = v.amountDue || 0;
        const balance = amountDue - totalPaid;

        if (balance > 0) {
          const earliestPayment = vPayments.reduce((prev, curr) =>
            new Date(prev.createdAt) < new Date(curr.createdAt) ? prev : curr
          );
          const earliestDate = new Date(earliestPayment.createdAt);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - earliestDate.getTime());
          const daysOutstanding = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const docName = v.doctorId ? (staffMap.get(v.doctorId) || '—') : '—';

          alertData.push({
            patientName: v.patient?.name || 'Unknown',
            doctorName: docName,
            totalAmount: `₹${amountDue}`,
            paidAmount: `₹${totalPaid}`,
            balance: `₹${balance}`,
            partialPaymentDate: earliestDate.toLocaleDateString(),
            daysOutstanding: `${daysOutstanding} days`,
            _rawDays: daysOutstanding
          });
        }
      }
    }

    alertData.sort((a, b) => b._rawDays - a._rawDays);

    let filteredData = alertData;
    if (overdueFilter === 'overdue') {
      filteredData = filteredData.filter(d => d._rawDays >= 3);
    } else if (overdueFilter === 'normal') {
      filteredData = filteredData.filter(d => d._rawDays < 3);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(d =>
        d.patientName.toLowerCase().includes(searchLower) ||
        d.doctorName.toLowerCase().includes(searchLower)
      );
    }

    const columns: ExportColumn[] = [
      { key: 'patientName', label: 'Patient Name' },
      { key: 'doctorName', label: 'Doctor Name' },
      { key: 'totalAmount', label: 'Total Amount' },
      { key: 'paidAmount', label: 'Paid Amount' },
      { key: 'balance', label: 'Balance' },
      { key: 'partialPaymentDate', label: 'Partial Payment Date' },
      { key: 'daysOutstanding', label: 'Days Outstanding' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, filteredData);
      res.header('Content-Type', 'text/csv');
      res.attachment('partial_payments_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, filteredData, 'Partial Payments');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('partial_payments_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, filteredData, 'Partial Payment Alerts Report', `Total Records: ${filteredData.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('partial_payments_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};

