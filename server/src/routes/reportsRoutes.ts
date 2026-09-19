import { Router } from 'express';
import { requireAuth, requireRole, requireModule } from '../middleware/authMiddleware';
import {
  getReportsSummary,
  getOverviewReport,
  getVisitsReport,
  exportVisitsReport,
  getRevenueReport,
  exportRevenueReport,
  getPatientsReport,
  exportPatientsReport,
  getTreatmentsReport,
  exportTreatmentsReport,
  getTreatmentCategories,
  getDoctorActivityReport,
  exportDoctorActivityReport,
  getMedicinesReport,
  exportMedicinesReport,
  getInventoryMovementsReport,
  exportInventoryMovementsReport,
  getProcurementReport,
  exportProcurementReport,
  // Legacy aliases
  getClinicActivityReport,
  exportClinicActivityReport,
  getPaymentReport,
  exportPaymentReport
} from '../controllers/reportsController';

const router = Router();

router.use(requireAuth, requireRole('Head Doctor'), requireModule('Reports'));

// All reports are strictly restricted to Head Doctor with Reports module access
router.get('/summary', getReportsSummary);

// 1. Overview
router.get('/overview', requireRole('Head Doctor'), getOverviewReport);

// 2. Visits
router.get('/visits', requireRole('Head Doctor'), getVisitsReport);
router.get('/visits/export', requireRole('Head Doctor'), exportVisitsReport);
// Legacy compatibility routes
router.get('/clinic-activity', requireRole('Head Doctor'), getClinicActivityReport);
router.get('/clinic-activity/export', requireRole('Head Doctor'), exportClinicActivityReport);

// 3. Revenue & Payments
router.get('/revenue', requireRole('Head Doctor'), getRevenueReport);
router.get('/revenue/export', requireRole('Head Doctor'), exportRevenueReport);
// Legacy compatibility routes
router.get('/payments', requireRole('Head Doctor'), getPaymentReport);
router.get('/payments/export', requireRole('Head Doctor'), exportPaymentReport);

// 4. Patients
router.get('/patients', requireRole('Head Doctor'), getPatientsReport);
router.get('/patients/export', requireRole('Head Doctor'), exportPatientsReport);

// 5. Treatments
router.get('/treatments/categories', requireRole('Head Doctor'), getTreatmentCategories);
router.get('/treatments', requireRole('Head Doctor'), getTreatmentsReport);
router.get('/treatments/export', requireRole('Head Doctor'), exportTreatmentsReport);

// 6. Doctor Activity
router.get('/doctors', requireRole('Head Doctor'), getDoctorActivityReport);
router.get('/doctors/export', requireRole('Head Doctor'), exportDoctorActivityReport);

// 7. Medicines & Dispensing
router.get('/medicines', requireRole('Head Doctor'), getMedicinesReport);
router.get('/medicines/export', requireRole('Head Doctor'), exportMedicinesReport);

// 8. Inventory Movements
router.get('/inventory-movements', requireRole('Head Doctor'), getInventoryMovementsReport);
router.get('/inventory-movements/export', requireRole('Head Doctor'), exportInventoryMovementsReport);

// 9. Procurement & Purchase Orders
router.get('/procurement', requireRole('Head Doctor'), getProcurementReport);
router.get('/procurement/export', requireRole('Head Doctor'), exportProcurementReport);

export default router;
