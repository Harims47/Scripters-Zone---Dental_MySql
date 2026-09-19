import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const mysql = require(path.resolve('./server/node_modules/mysql2/promise'));

const DB_URL = process.env.DATABASE_URL || 'mysql://dental:dentalpassword@127.0.0.1:3306/dentalcore';

let pool: any = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      uri: DB_URL,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      decimalNumbers: true,
      namedPlaceholders: true
    });
  }
  return pool;
}

/**
 * Execute a strictly read-only SQL query returning multiple rows.
 * Fails if the query attempts any write mutation.
 */
export async function queryMany<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const trimmed = sql.trim().toLowerCase();
  if (trimmed.startsWith('insert') || trimmed.startsWith('update') || trimmed.startsWith('delete') || trimmed.startsWith('drop') || trimmed.startsWith('alter')) {
    throw new Error(`Forbidden mutation query detected in read-only db helper: ${sql}`);
  }
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

/**
 * Execute a strictly read-only SQL query returning a single row or null.
 */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryMany<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Capture a complete baseline snapshot of record counts and key metrics from MySQL.
 */
export async function getDatabaseSnapshot() {
  const [
    patientsCount,
    activePatientsCount,
    appointmentsCount,
    todayAppointmentsCount,
    visitsCount,
    waitingVisitsCount,
    withDoctorVisitsCount,
    completedVisitsCount,
    queueCount,
    waitingQueueCount,
    inProgressQueueCount,
    paymentsCount,
    financials,
    medicinesCount,
    totalStock,
    lowStockCount,
    suppliersCount,
    purchaseOrdersCount,
    prescriptionsCount,
    reimbursementsCount
  ] = await Promise.all([
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Patient'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Patient WHERE status = "Active"'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Appointment'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Appointment WHERE date = CURDATE() AND status NOT IN ("Cancelled", "No Show")'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Visit'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Visit WHERE status = "WAITING"'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Visit WHERE status = "WITH_DOCTOR"'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Visit WHERE status = "COMPLETED"'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM QueueEntry'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM QueueEntry WHERE status IN ("Waiting", "Called")'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM QueueEntry WHERE status IN ("In Progress", "With Doctor")'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Payment WHERE status != "Failed"'),
    queryOne<{ totalPaid: number, totalDue: number }>(`
      SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM Payment WHERE status != 'Failed') as totalPaid,
        (SELECT COALESCE(SUM(amountDue), 0) FROM Visit WHERE status != 'CANCELLED') as totalDue
    `),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Medicine WHERE status = "Active"'),
    queryOne<{ totalStock: number }>('SELECT COALESCE(SUM(currentStock), 0) as totalStock FROM Medicine'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Medicine WHERE currentStock <= stockWarningLevel AND status = "Active"'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Supplier'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM PurchaseOrder'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM Prescription'),
    queryOne<{ count: number }>('SELECT COUNT(*) as count FROM ReimbursementDocument')
  ]);

  return {
    patients: {
      total: Number(patientsCount?.count || 0),
      active: Number(activePatientsCount?.count || 0)
    },
    appointments: {
      total: Number(appointmentsCount?.count || 0),
      today: Number(todayAppointmentsCount?.count || 0)
    },
    visits: {
      total: Number(visitsCount?.count || 0),
      waiting: Number(waitingVisitsCount?.count || 0),
      withDoctor: Number(withDoctorVisitsCount?.count || 0),
      completed: Number(completedVisitsCount?.count || 0)
    },
    queue: {
      total: Number(queueCount?.count || 0),
      waiting: Number(waitingQueueCount?.count || 0),
      inProgress: Number(inProgressQueueCount?.count || 0)
    },
    payments: {
      count: Number(paymentsCount?.count || 0),
      totalPaid: Number(financials?.totalPaid || 0),
      totalDue: Number(financials?.totalDue || 0)
    },
    inventory: {
      medicines: Number(medicinesCount?.count || 0),
      totalStock: Number(totalStock?.totalStock || 0),
      lowStock: Number(lowStockCount?.count || 0)
    },
    suppliers: Number(suppliersCount?.count || 0),
    purchaseOrders: Number(purchaseOrdersCount?.count || 0),
    prescriptions: Number(prescriptionsCount?.count || 0),
    reimbursements: Number(reimbursementsCount?.count || 0)
  };
}

/**
 * Authoritative direct MySQL calculation of Dashboard KPIs.
 * Matches the logic in server/src/controllers/dashboardController.ts.
 */
export async function getDashboardKPIsFromDB() {
  const [
    waitingNow,
    todayAppointments,
    withDoctors,
    readyForReception,
    completedToday,
    todayVisits,
    todayCollections,
    pendingBalances
  ] = await Promise.all([
    queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM QueueEntry q
      JOIN Visit v ON q.visitId = v.id
      WHERE q.status = 'Waiting'
      AND v.status != 'CANCELLED'
      AND DATE(q.createdAt) = CURDATE()
    `),
    queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM Appointment
      WHERE date = CURDATE() AND status NOT IN ("Cancelled", "No Show")
    `),
    queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM QueueEntry q
      JOIN Visit v ON q.visitId = v.id
      WHERE q.status IN ("In Progress", "With Doctor")
      AND v.status NOT IN ("CANCELLED", "COMPLETED")
      AND DATE(q.createdAt) = CURDATE()
    `),
    queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM Visit
      WHERE status = 'READY_FOR_RECEPTION'
      AND DATE(createdAt) = CURDATE()
    `),
    queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM Visit
      WHERE status = "COMPLETED" AND DATE(createdAt) = CURDATE()
    `),
    queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM Visit
      WHERE DATE(createdAt) = CURDATE() AND status != "CANCELLED"
    `),
    queryOne<{ totalAmount: number, count: number }>(`
      SELECT COALESCE(SUM(amount), 0) as totalAmount, COUNT(*) as count
      FROM Payment
      WHERE DATE(createdAt) = CURDATE() AND status != "Failed"
    `),
    queryOne<{ totalPending: number, count: number }>(`
      SELECT 
        COALESCE(SUM(GREATEST(0, v.amountDue - COALESCE(p.paid, 0))), 0) AS totalPending,
        COUNT(CASE WHEN (v.amountDue - COALESCE(p.paid, 0)) > 0 THEN 1 END) AS count
      FROM Visit v
      LEFT JOIN (
        SELECT visitId, SUM(amount) AS paid
        FROM Payment
        WHERE status != 'Failed'
        GROUP BY visitId
      ) p ON v.id = p.visitId
      WHERE DATE(v.createdAt) = CURDATE() 
      AND v.status NOT IN ('CANCELLED', 'COMPLETED')
    `)
  ]);

  return {
    waitingNowCount: Number(waitingNow?.count || 0),
    todayAppointmentsCount: Number(todayAppointments?.count || 0),
    withDoctorsCount: Number(withDoctors?.count || 0),
    readyForReceptionCount: Number(readyForReception?.count || 0),
    completedTodayCount: Number(completedToday?.count || 0),
    totalVisitsToday: Number(todayVisits?.count || 0),
    todayCollectionsAmount: Number(todayCollections?.totalAmount || 0),
    todayCollectionsCount: Number(todayCollections?.count || 0),
    totalPendingBalance: Number(pendingBalances?.totalPending || 0),
    pendingPaymentsCount: Number(pendingBalances?.count || 0)
  };
}

/**
 * Entity-specific read-only helper queries for assertions
 */
export async function getPatientByName(name: string) {
  return queryOne('SELECT * FROM Patient WHERE name = ? ORDER BY createdAt DESC LIMIT 1', [name]);
}

export async function getPatientByPhone(phone: string) {
  return queryOne('SELECT * FROM Patient WHERE phone = ? ORDER BY createdAt DESC LIMIT 1', [phone]);
}

export async function getVisitById(id: string) {
  return queryOne('SELECT * FROM Visit WHERE id = ?', [id]);
}

export async function getLatestVisitForPatient(patientId: string) {
  return queryOne('SELECT * FROM Visit WHERE patientId = ? ORDER BY createdAt DESC LIMIT 1', [patientId]);
}

export async function getQueueEntryForVisit(visitId: string) {
  return queryOne('SELECT * FROM QueueEntry WHERE visitId = ?', [visitId]);
}

export async function getAppointmentsForPatient(patientId: string) {
  return queryMany('SELECT * FROM Appointment WHERE patientId = ? ORDER BY createdAt DESC', [patientId]);
}

export async function getConsultationForVisit(visitId: string) {
  return queryOne('SELECT * FROM Consultation WHERE visitId = ?', [visitId]);
}

export async function getPrescriptionForVisit(visitId: string) {
  return queryOne('SELECT * FROM Prescription WHERE visitId = ?', [visitId]);
}

export async function getPrescriptionItems(prescriptionId: string) {
  return queryMany('SELECT * FROM PrescriptionItem WHERE prescriptionId = ?', [prescriptionId]);
}

export async function getDispensingForPrescription(prescriptionId: string) {
  return queryOne('SELECT * FROM Dispensing WHERE prescriptionId = ?', [prescriptionId]);
}

export async function getPaymentsForVisit(visitId: string) {
  return queryMany('SELECT * FROM Payment WHERE visitId = ? ORDER BY createdAt ASC', [visitId]);
}

export async function getMedicineByName(name: string) {
  return queryOne('SELECT * FROM Medicine WHERE name = ?', [name]);
}

export async function getPurchaseOrdersForSupplier(supplierName: string) {
  return queryMany(`
    SELECT po.* FROM PurchaseOrder po
    JOIN Supplier s ON po.supplierId = s.id
    WHERE s.name = ?
    ORDER BY po.createdAt DESC
  `, [supplierName]);
}

export async function getSupplierBills(supplierId?: string) {
  if (supplierId) {
    return queryMany('SELECT * FROM SupplierBill WHERE supplierId = ? ORDER BY createdAt DESC', [supplierId]);
  }
  return queryMany('SELECT * FROM SupplierBill ORDER BY createdAt DESC');
}

export async function getReimbursementsForPatient(patientId: string) {
  return queryMany('SELECT * FROM ReimbursementDocument WHERE patientId = ? ORDER BY createdAt DESC', [patientId]);
}

export async function getActiveStaffDoctors() {
  return queryMany('SELECT * FROM Staff WHERE role IN ("Head Doctor", "Duty Doctor") AND status = "Active"');
}

/**
 * Close pool when tests finish
 */
export async function closeDbPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

