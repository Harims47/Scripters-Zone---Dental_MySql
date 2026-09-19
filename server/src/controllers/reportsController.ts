import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import {
  getOverviewReportData,
  getVisitsReportData,
  getVisitsExportData,
  getRevenueReportData,
  getRevenueExportData,
  getPatientsReportData,
  getPatientsExportData,
  getTreatmentsReportData,
  getTreatmentsExportData,
  getDoctorActivityReportData,
  getMedicinesReportData,
  getMedicinesExportData,
  getInventoryMovementsReportData,
  getInventoryMovementsExportData,
  getProcurementReportData,
  getProcurementExportData
} from '../services/reportsService';
import { parseDateRange, buildPrismaDateFilter } from '../utils/dateRangeHelper';
import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

/**
 * 0. LEGACY SUMMARY (Maintained for backward-compatibility with current ReportsPage UI)
 */
export const getReportsSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    let dateFilter: any = undefined;
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      };
    }

    // 1. Clinic Summary
    const visits = await prisma.visit.findMany({ 
      where: dateFilter,
      select: { patientId: true, status: true } 
    });
    const uniquePatientsSeen = new Set(visits.map(v => v.patientId)).size;
    const completedVisits = visits.filter(v => v.status === 'COMPLETED').length;
    const pendingVisits = visits.filter(v => v.status !== 'COMPLETED' && v.status !== 'CANCELLED').length;
    
    const totalAppointments = await prisma.appointment.count({
      where: dateFilter
    });

    // 2. Payment Summary directly from Payment model
    const paymentWhere: any = { status: 'Completed' };
    if (dateFilter) paymentWhere.createdAt = dateFilter;

    const paymentAgg = await prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
      _count: { id: true }
    });

    const cashAgg = await prisma.payment.aggregate({
      where: { ...paymentWhere, method: 'Cash' },
      _sum: { amount: true }
    });

    const gpayAgg = await prisma.payment.aggregate({
      where: { ...paymentWhere, method: 'GPay' },
      _sum: { amount: true }
    });

    // 3. Medicine Dispensing Summary
    const dispWhere: any = {};
    if (dateFilter) dispWhere.dispensing = { createdAt: dateFilter };

    const dispAgg = await prisma.dispensingItem.aggregate({
      where: dispWhere,
      _sum: { dispensedQuantity: true }
    });

    const totalDispensingTx = await prisma.dispensing.count({
      where: dateFilter ? { createdAt: dateFilter } : undefined
    });

    // 4. Inventory Snapshot
    const totalItems = await prisma.medicine.count();
    const allStockItems = await prisma.medicine.findMany({
      select: { currentStock: true, stockWarningLevel: true }
    });
    const lowStockItems = allStockItems.filter(i => i.currentStock > 0 && i.currentStock < i.stockWarningLevel).length;
    const outOfStockItems = allStockItems.filter(i => i.currentStock === 0).length;

    return res.json({
      clinicSummary: {
        uniquePatientsSeen,
        completedVisits,
        pendingVisits,
        totalAppointments
      },
      paymentSummary: {
        totalRevenue: paymentAgg._sum.amount || 0,
        cashCollected: cashAgg._sum.amount || 0,
        gpayCollected: gpayAgg._sum.amount || 0,
        paymentCount: paymentAgg._count.id || 0
      },
      dispensingSummary: {
        dispensingTransactions: totalDispensingTx,
        totalItemsDispensed: dispAgg._sum.dispensedQuantity || 0
      },
      inventorySnapshot: {
        totalItems,
        lowStockItems,
        outOfStockItems
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 1. OVERVIEW REPORT
 */
export const getOverviewReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getOverviewReportData(req.query as any);
    return res.json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. VISITS REPORT
 */
export const getVisitsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getVisitsReportData(req.query as any);
    return res.json(data);
  } catch (error) {
    next(error);
  }
};

export const exportVisitsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const rows = await getVisitsExportData(req.query as any);

    const columns: ExportColumn[] = [
      { key: 'visitDateTime', label: 'Visit Date & Time' },
      { key: 'patientName', label: 'Patient Name' },
      { key: 'visitType', label: 'Visit Type' },
      { key: 'doctorName', label: 'Doctor' },
      { key: 'reasonForVisit', label: 'Reason for Visit' },
      { key: 'status', label: 'Status' },
      { key: 'amountDue', label: 'Amount Due' },
      { key: 'totalPaid', label: 'Total Paid' },
      { key: 'balance', label: 'Balance' }
    ];

    const subtitle = `Total Records: ${rows.length}`;

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('visits_report.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Visits');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('visits_report.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Clinic Visits Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('visits_report.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format. Must be csv, xlsx, or pdf.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 3. REVENUE / PAYMENTS REPORT
 */
export const getRevenueReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getRevenueReportData(req.query as any);
    return res.json(data);
  } catch (error) {
    next(error);
  }
};

export const exportRevenueReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const rows = await getRevenueExportData(req.query as any);

    const columns: ExportColumn[] = [
      { key: 'paymentDate', label: 'Payment Date & Time' },
      { key: 'patientName', label: 'Patient Name' },
      { key: 'doctorName', label: 'Doctor' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'amount', label: 'Amount' },
      { key: 'paymentStatus', label: 'Status' },
      { key: 'notes', label: 'Notes' }
    ];

    const subtitle = `Total Transactions: ${rows.length}`;

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('revenue_payments_report.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Revenue');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('revenue_payments_report.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Revenue & Payment Transactions Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('revenue_payments_report.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format. Must be csv, xlsx, or pdf.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 4. PATIENTS REPORT
 */
export const getPatientsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getPatientsReportData(req.query as any);
    return res.json(data);
  } catch (error) {
    next(error);
  }
};

export const exportPatientsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const rows = await getPatientsExportData(req.query as any);

    const columns: ExportColumn[] = [
      { key: 'patientName', label: 'Patient Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'age', label: 'Age' },
      { key: 'gender', label: 'Gender' },
      { key: 'patientType', label: 'Patient Type' },
      { key: 'totalVisitsAllTime', label: 'Total Visits' },
      { key: 'lastVisitDate', label: 'Last Visit' },
      { key: 'registeredDate', label: 'Registered Date' }
    ];

    const subtitle = `Total Patients: ${rows.length}`;

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('patients_report.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Patients');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('patients_report.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Patients Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('patients_report.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format. Must be csv, xlsx, or pdf.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 5. TREATMENTS REPORT
 */
export const getTreatmentsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getTreatmentsReportData(req.query as any);
    return res.json(data);
  } catch (error) {
    next(error);
  }
};

export const exportTreatmentsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const rows = await getTreatmentsExportData(req.query as any);

    const columns: ExportColumn[] = [
      { key: 'category', label: 'Category' },
      { key: 'treatmentName', label: 'Treatment Name' },
      { key: 'completedCount', label: 'Completed' }
    ];

    const subtitle = `Total Treatments: ${rows.length}`;

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('treatments_report.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Treatments');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('treatments_report.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Treatments Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('treatments_report.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format. Must be csv, xlsx, or pdf.' });
    }
  } catch (error) {
    next(error);
  }
};

export const getTreatmentCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cats = await prisma.treatmentCatalog.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    });
    return res.json(cats.map(c => c.category).filter(Boolean));
  } catch (error) {
    next(error);
  }
};

/**
 * 6. DOCTORS ACTIVITY REPORT
 */
export const getDoctorActivityReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const rows = await getDoctorActivityReportData(startDate, endDate);
    return res.json({ data: rows });
  } catch (error) {
    next(error);
  }
};

export const exportDoctorActivityReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, format } = req.query as { startDate?: string; endDate?: string; format?: string };
    const rows = await getDoctorActivityReportData(startDate, endDate);

    const columns: ExportColumn[] = [
      { key: 'doctorName', label: 'Doctor Name' },
      { key: 'role', label: 'Role' },
      { key: 'totalAssignedVisits', label: 'Assigned Visits' },
      { key: 'completedVisits', label: 'Completed Visits' }
    ];

    const subtitle = `Doctor Workload Report | Total Staff: ${rows.length}`;

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('doctor_activity_report.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Doctor Activity');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('doctor_activity_report.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Doctor Workload & Activity Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('doctor_activity_report.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format. Must be csv, xlsx, or pdf.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 7. MEDICINES DISPENSING REPORT
 */
export const getMedicinesReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getMedicinesReportData(req.query as any);
    return res.json(data);
  } catch (error) {
    next(error);
  }
};

export const exportMedicinesReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const rows = await getMedicinesExportData(req.query as any);

    const columns: ExportColumn[] = [
      { key: 'medicineName', label: 'Medicine' },
      { key: 'genericName', label: 'Generic Name' },
      { key: 'category', label: 'Category' },
      { key: 'totalPrescribedQuantity', label: 'Prescribed Qty' },
      { key: 'totalDispensedQuantity', label: 'Dispensed Qty' },
      { key: 'currentStock', label: 'Current Stock' }
    ];

    const subtitle = `Total Medicines: ${rows.length}`;

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('medicines_report.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Medicines');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('medicines_report.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Medicines & Dispensing Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('medicines_report.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format. Must be csv, xlsx, or pdf.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 8. INVENTORY MOVEMENTS REPORT
 */
export const getInventoryMovementsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getInventoryMovementsReportData(req.query as any);
    return res.json(data);
  } catch (error) {
    next(error);
  }
};

export const exportInventoryMovementsReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const rows = await getInventoryMovementsExportData(req.query as any);

    const columns: ExportColumn[] = [
      { key: 'dateTime', label: 'Date & Time' },
      { key: 'medicineName', label: 'Medicine' },
      { key: 'movementType', label: 'Movement Type' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'balanceAfter', label: 'Balance After' },
      { key: 'performedBy', label: 'Performed By' },
      { key: 'reason', label: 'Reason / Notes' }
    ];

    const subtitle = `Total Stock Movements: ${rows.length}`;

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('inventory_movements_report.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Movements');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('inventory_movements_report.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Inventory Movements Ledger Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('inventory_movements_report.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format. Must be csv, xlsx, or pdf.' });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 9. PROCUREMENT REPORT
 */
export const getProcurementReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getProcurementReportData(req.query as any);
    return res.json(data);
  } catch (error) {
    next(error);
  }
};

export const exportProcurementReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'csv';
    const section = (req.query.section as string) || 'orders';

    if (section === 'bills') {
      const { startDate, endDate } = parseDateRange(req.query.startDate as string, req.query.endDate as string);
      const billDateFilter = buildPrismaDateFilter(startDate, endDate);
      const billWhere: any = { status: { not: 'Cancelled' } };
      if (billDateFilter) billWhere.invoiceDate = billDateFilter;
      if (req.query.supplierId && req.query.supplierId !== 'all') billWhere.supplierId = req.query.supplierId as string;

      const bills = await prisma.supplierBill.findMany({
        where: billWhere,
        include: { supplier: true, payments: true },
        orderBy: { invoiceDate: 'desc' }
      });

      const rows = bills.map(b => {
        const paid = b.payments.reduce((s, p) => s + p.amount, 0);
        return {
          invoiceNumber: b.invoiceNumber,
          supplierName: b.supplier?.name || '—',
          invoiceDate: new Date(b.invoiceDate).toLocaleDateString(),
          amount: `₹${b.amount}`,
          paid: `₹${paid}`,
          balance: `₹${Math.max(0, b.amount - paid)}`,
          status: b.status,
          notes: b.notes || '—'
        };
      });

      const columns: ExportColumn[] = [
        { key: 'invoiceNumber', label: 'Invoice Number' },
        { key: 'supplierName', label: 'Supplier' },
        { key: 'invoiceDate', label: 'Invoice Date' },
        { key: 'amount', label: 'Bill Amount' },
        { key: 'paid', label: 'Paid Amount' },
        { key: 'balance', label: 'Balance Outstanding' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' }
      ];

      const subtitle = `Total Invoices: ${rows.length}`;

      if (format === 'csv') {
        const csv = generateCSV(columns, rows);
        res.header('Content-Type', 'text/csv');
        res.attachment('supplier_bills_report.csv');
        return res.send(csv);
      } else if (format === 'xlsx') {
        const xlsx = await generateXLSX(columns, rows, 'Supplier Bills');
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('supplier_bills_report.xlsx');
        return res.send(xlsx);
      } else if (format === 'pdf') {
        const pdf = await generatePDF(columns, rows, 'Supplier Bills & Invoices Report', subtitle);
        res.header('Content-Type', 'application/pdf');
        res.attachment('supplier_bills_report.pdf');
        return res.send(pdf);
      }
    } else if (section === 'payments') {
      const { startDate, endDate } = parseDateRange(req.query.startDate as string, req.query.endDate as string);
      const paymentDateFilter = buildPrismaDateFilter(startDate, endDate);
      const paymentWhere: any = {};
      if (paymentDateFilter) paymentWhere.date = paymentDateFilter;
      if (req.query.supplierId && req.query.supplierId !== 'all') paymentWhere.bill = { supplierId: req.query.supplierId as string };

      const payments = await prisma.supplierPayment.findMany({
        where: paymentWhere,
        include: { bill: { include: { supplier: true } } },
        orderBy: { date: 'desc' }
      });

      const rows = payments.map(p => ({
        paymentDate: new Date(p.date).toLocaleDateString(),
        invoiceNumber: p.bill?.invoiceNumber || '—',
        supplierName: p.bill?.supplier?.name || '—',
        method: p.method,
        amount: `₹${p.amount}`,
        notes: p.notes || '—'
      }));

      const columns: ExportColumn[] = [
        { key: 'paymentDate', label: 'Payment Date' },
        { key: 'invoiceNumber', label: 'Invoice Number' },
        { key: 'supplierName', label: 'Supplier' },
        { key: 'method', label: 'Method' },
        { key: 'amount', label: 'Amount Paid' },
        { key: 'notes', label: 'Notes' }
      ];

      const subtitle = `Total Payments: ${rows.length}`;

      if (format === 'csv') {
        const csv = generateCSV(columns, rows);
        res.header('Content-Type', 'text/csv');
        res.attachment('supplier_payments_report.csv');
        return res.send(csv);
      } else if (format === 'xlsx') {
        const xlsx = await generateXLSX(columns, rows, 'Supplier Payments');
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('supplier_payments_report.xlsx');
        return res.send(xlsx);
      } else if (format === 'pdf') {
        const pdf = await generatePDF(columns, rows, 'Supplier Payments Report', subtitle);
        res.header('Content-Type', 'application/pdf');
        res.attachment('supplier_payments_report.pdf');
        return res.send(pdf);
      }
    }

    const rows = await getProcurementExportData(req.query as any);

    const columns: ExportColumn[] = [
      { key: 'orderNumber', label: 'PO Number' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'orderDate', label: 'Order Date' },
      { key: 'lineItemsCount', label: 'Items' },
      { key: 'orderedQuantity', label: 'Ordered Qty' },
      { key: 'receivedQuantity', label: 'Received Qty' },
      { key: 'totalCostValue', label: 'Total Value' },
      { key: 'status', label: 'Status' }
    ];

    const subtitle = `Total Purchase Orders: ${rows.length}`;

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('procurement_report.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Procurement');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('procurement_report.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Procurement & Purchase Orders Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('procurement_report.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format. Must be csv, xlsx, or pdf.' });
    }
  } catch (error) {
    next(error);
  }
};

// Aliases for legacy compatibility
export const getClinicActivityReport = getVisitsReport;
export const exportClinicActivityReport = exportVisitsReport;
export const getPaymentReport = getRevenueReport;
export const exportPaymentReport = exportRevenueReport;
