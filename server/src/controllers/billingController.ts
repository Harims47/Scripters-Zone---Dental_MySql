import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getBillingQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const statusQuery = req.query.status as string;
    const allowedStatuses = statusQuery ? statusQuery.split(',') : ['READY_FOR_RECEPTION', 'READY_FOR_PAYMENT', 'COMPLETED'];

    const where: any = {
      status: { in: allowedStatuses }
    };
    if (req.user?.role === 'Receptionist') {
      where.paymentOwner = { not: 'DOCTOR' };
    }

    if (search) {
      where.OR = [
        { id: { contains: search } },
        { patient: { name: { contains: search } } },
        { patient: { id: { contains: search } } }
      ];
    }

    const [visits, totalRecords] = await Promise.all([
      prisma.visit.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: true,
          prescription: {
            include: { items: true }
          },
          dispensing: true,
          payments: true
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.visit.count({ where })
    ]);

    return res.json({
      data: visits,
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

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportBillingQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const statusQuery = req.query.status as string;
    const format = req.query.format as string;

    const allowedStatuses = statusQuery ? statusQuery.split(',') : ['READY_FOR_RECEPTION', 'READY_FOR_PAYMENT', 'COMPLETED'];

    const where: any = {
      status: { in: allowedStatuses }
    };
    if (req.user?.role === 'Receptionist') {
      where.paymentOwner = { not: 'DOCTOR' };
    }

    if (search) {
      where.OR = [
        { id: { contains: search } },
        { patient: { name: { contains: search } } },
        { patient: { id: { contains: search } } }
      ];
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        patient: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    const formattedData = visits.map(v => ({
      id: v.id,
      patientId: v.patientId,
      patientName: v.patient?.name || 'Unknown',
      status: v.status,
      consultationFee: v.consultationFee ?? 0,
      treatmentFee: v.treatmentFee ?? 0,
      medicineCost: v.medicineCost ?? 0,
      amountDue: v.amountDue ?? 0
    }));

    const columns: ExportColumn[] = [
      { key: 'id', label: 'Visit ID' },
      { key: 'patientId', label: 'Patient ID' },
      { key: 'patientName', label: 'Patient Name' },
      { key: 'status', label: 'Status' },
      { key: 'consultationFee', label: 'Consultation Fee' },
      { key: 'treatmentFee', label: 'Treatment Fee' },
      { key: 'medicineCost', label: 'Medicine Cost' },
      { key: 'amountDue', label: 'Amount Due' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, formattedData);
      res.header('Content-Type', 'text/csv');
      res.attachment('billing_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, formattedData, 'Billing');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('billing_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, formattedData, 'Billing Report', `Total Records: ${formattedData.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('billing_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};
