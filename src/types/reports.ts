export interface ClinicOverviewKpi {
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  walkInVisits: number;
  appointmentVisits: number;
  newPatients: number;
  existingPatientVisits: number;
  totalAmountDue: number;
  totalAmountCollected: number;
  outstandingAmount: number;
}

export interface OverviewDailyTrendItem {
  date: string;
  visits: number;
  walkIns: number;
  appointments: number;
  newPatients: number;
  existingPatientVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  amountDue: number;
  amountCollected: number;
  outstanding: number;
}

export interface OverviewReportResponse {
  summary: ClinicOverviewKpi;
  trend: OverviewDailyTrendItem[];
}

export interface VisitReportItem {
  id: string;
  visitDateTime: string;
  patientId: string;
  patientName: string;
  visitType: 'Walk-in' | 'Appointment';
  doctorName: string;
  reasonForVisit: string;
  status: string;
  amountDue: number;
  totalPaid: number;
  balance: number;
}

export interface VisitsReportResponse {
  summary: {
    totalVisits: number;
    completed: number;
    cancelled: number;
    walkIns: number;
    appointments: number;
  };
  data: VisitReportItem[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export interface RevenueReportItem {
  paymentId: string;
  paymentDate: string;
  patientId: string;
  patientName: string;
  visitId: string;
  doctorName: string;
  paymentMethod: string;
  amount: number;
  paymentStatus: string;
  notes: string;
}

export interface RevenueReportResponse {
  summary: {
    totalAmountDue: number;
    totalCollected: number;
    outstandingAmount: number;
    paidVisits: number;
    partialPaymentVisits: number;
    unpaidVisits: number;
  };
  methodBreakdown: {
    [key in 'Cash' | 'GPay' | 'Credit Card' | 'Debit Card']?: {
      transactionCount: number;
      amount: number;
    };
  };
  trend: { date: string; amountCollected: number }[];
  data: RevenueReportItem[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export interface PatientReportItem {
  patientId: string;
  patientName: string;
  phone: string;
  age: number;
  gender: string;
  patientType: 'New' | 'Returning';
  totalVisitsAllTime: number;
  lastVisitDate: string;
  registeredDate: string;
}

export interface PatientsReportResponse {
  data: PatientReportItem[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export interface TreatmentReportItem {
  id: string;
  category: string;
  treatmentName: string;
  variant: string;
  plannedCount: number;
  completedCount: number;
  uniquePatients: number;
}

export interface TreatmentsReportResponse {
  summary: {
    totalPlanned: number;
    totalCompleted: number;
  };
  data: TreatmentReportItem[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export interface DoctorActivityItem {
  doctorId: string;
  doctorName: string;
  role: string;
  totalAssignedVisits: number;
  newPatientsSeen: number;
  returningPatientsSeen: number;
  completedVisits: number;
  cancelledVisits: number;
}

export interface DoctorActivityResponse {
  data: DoctorActivityItem[];
}

export interface MedicineReportItem {
  id: string;
  medicineName: string;
  genericName: string;
  category: string;
  totalPrescribedQuantity: number;
  totalDispensedQuantity: number;
  dispensingTransactions: number;
  currentStock: number;
}

export interface MedicinesReportResponse {
  summary: {
    totalDispensedUnits: number;
  };
  data: MedicineReportItem[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export interface InventoryMovementItem {
  id: string;
  dateTime: string;
  medicineName: string;
  movementType: 'PURCHASE_RECEIPT' | 'DISPENSING' | 'ADJUSTMENT';
  quantity: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  performedBy: string;
  reason: string;
}

export interface InventoryMovementsResponse {
  summary: {
    stockReceived: number;
    stockDispensed: number;
    adjustmentCount: number;
    netAdjustmentQuantity: number;
  };
  data: InventoryMovementItem[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export interface ProcurementReportItem {
  id: string;
  orderNumber: string;
  supplierName: string;
  orderDate: string;
  lineItemsCount: number;
  orderedQuantity: number;
  receivedQuantity: number;
  totalCostValue: number;
  status: string;
}

export interface SupplierProcurementSummary {
  supplierId: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  totalPOs: number;
  totalItemsOrdered: number;
  totalItemsReceived: number;
  totalPurchaseValue: number;
  lastOrderDate: string | null;
}

export interface ProcurementReportBillItem {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplierId: string;
  amount: number;
  totalPaid: number;
  balance: number;
  status: string;
  purchaseOrderId?: string | null;
}

export interface ProcurementReportPaymentItem {
  id: string;
  billId: string;
  invoiceNumber: string;
  supplierName: string;
  amount: number;
  method: string;
  date: string;
  notes?: string | null;
}

export interface ProcurementReportResponse {
  summary: {
    totalPOs: number;
    draftPOs: number;
    orderedPOs: number;
    partiallyReceivedPOs: number;
    receivedPOs: number;
    cancelledPOs: number;
    totalBillsCount?: number;
    totalBilledAmount?: number;
    totalPaidAmount?: number;
    totalOutstandingBalance?: number;
    billStatusCounts?: {
      Unpaid: number;
      Partial: number;
      Paid: number;
    };
    paymentMethodBreakdown?: Record<string, number>;
  };
  data: ProcurementReportItem[];
  bills?: ProcurementReportBillItem[];
  payments?: ProcurementReportPaymentItem[];
  supplierSummary: SupplierProcurementSummary[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}
