import { prisma } from '../db';
import { parseDateRange, buildPrismaDateFilter, getDateArrayBetween } from '../utils/dateRangeHelper';

/**
 * 1. OVERVIEW REPORT
 */
export interface OverviewFilterParams {
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  visitType?: string; // 'Walk-in' | 'Appointment'
}

export async function getOverviewReportData(params: OverviewFilterParams) {
  const { startDate, endDate, hasFilter } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const where: any = {};
  if (dateFilter) where.createdAt = dateFilter;
  if (params.doctorId && params.doctorId !== 'all') where.doctorId = params.doctorId;
  if (params.visitType === 'Walk-in') where.appointmentId = null;
  if (params.visitType === 'Appointment') where.appointmentId = { not: null };

  // Fetch visits in window for KPI metrics
  const visits = await prisma.visit.findMany({
    where,
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      appointmentId: true,
      status: true,
      amountDue: true,
      createdAt: true,
      payments: {
        where: { status: 'Completed' },
        select: { amount: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const totalVisits = visits.length;
  const completedVisits = visits.filter(v => v.status === 'COMPLETED').length;
  const cancelledVisits = visits.filter(v => v.status === 'CANCELLED').length;
  const walkInVisits = visits.filter(v => v.appointmentId === null).length;
  const appointmentVisits = visits.filter(v => v.appointmentId !== null).length;

  // New vs Existing logic:
  // Patient is NEW if their earliest-ever clinic visit is in this date range.
  // Patient is EXISTING if they have at least one visit strictly before startDate.
  // We collect all unique patient IDs from this batch of visits.
  const patientIds = Array.from(new Set(visits.map(v => v.patientId)));

  let newPatientIds = new Set<string>();
  if (patientIds.length > 0) {
    // For each patient in this batch, find their very first visit timestamp
    const firstVisits = await prisma.visit.groupBy({
      by: ['patientId'],
      where: { patientId: { in: patientIds } },
      _min: { createdAt: true }
    });

    for (const fv of firstVisits) {
      const minDate = fv._min.createdAt;
      if (minDate) {
        if (!startDate && !endDate) {
          // All time: all unique patients are new in this window
          newPatientIds.add(fv.patientId);
        } else {
          const isAfterStart = !startDate || minDate >= startDate;
          const isBeforeEnd = !endDate || minDate <= endDate;
          if (isAfterStart && isBeforeEnd) {
            newPatientIds.add(fv.patientId);
          }
        }
      }
    }
  }

  // Count visits by new vs existing patients
  // Each visit whose patient first visited in this window is from a new patient
  // (Or new patients count can be unique new patients seen)
  const newPatients = newPatientIds.size;
  const existingPatientVisits = visits.filter(v => !newPatientIds.has(v.patientId)).length;

  // Financial aggregates:
  // Exclude cancelled visits from amountDue/receivables per audit rules
  const activeVisits = visits.filter(v => v.status !== 'CANCELLED');
  const totalAmountDue = activeVisits.reduce((sum, v) => sum + (v.amountDue || 0), 0);

  // Authoritative revenue collected:
  // Note: Payments within the date range are queried directly from Payment model to avoid join inaccuracies
  const paymentWhere: any = { status: 'Completed' };
  if (dateFilter) paymentWhere.createdAt = dateFilter;
  if (params.doctorId && params.doctorId !== 'all') paymentWhere.visit = { doctorId: params.doctorId };

  const paymentAgg = await prisma.payment.aggregate({
    where: paymentWhere,
    _sum: { amount: true }
  });
  const totalAmountCollected = paymentAgg._sum.amount || 0;

  // Outstanding per-visit (capped at 0 min) for visits in the period
  let outstandingAmount = 0;
  for (const v of activeVisits) {
    const paidForVisit = v.payments.reduce((sum, p) => sum + p.amount, 0);
    const bal = Math.max(0, (v.amountDue || 0) - paidForVisit);
    outstandingAmount += bal;
  }

  // Daily Trend calculation
  // Group visits and payments by date (YYYY-MM-DD)
  let trendDays: string[] = [];
  if (startDate && endDate) {
    // Generate full contiguous date range
    trendDays = getDateArrayBetween(startDate, endDate);
  } else {
    // Collect distinct dates from visits
    const dateSet = new Set<string>();
    visits.forEach(v => dateSet.add(v.createdAt.toISOString().split('T')[0]));
    trendDays = Array.from(dateSet).sort();
  }

  const visitsByDay: Record<string, typeof visits> = {};
  for (const v of visits) {
    const day = v.createdAt.toISOString().split('T')[0];
    if (!visitsByDay[day]) visitsByDay[day] = [];
    visitsByDay[day].push(v);
  }

  // Query payments by day for trend
  const allPaymentsInPeriod = await prisma.payment.findMany({
    where: paymentWhere,
    select: { amount: true, createdAt: true }
  });
  const paymentsByDay: Record<string, number> = {};
  for (const p of allPaymentsInPeriod) {
    const day = p.createdAt.toISOString().split('T')[0];
    paymentsByDay[day] = (paymentsByDay[day] || 0) + p.amount;
  }

  const dailyTrend = trendDays.map(dateStr => {
    const dayVisits = visitsByDay[dateStr] || [];
    const vCount = dayVisits.length;
    const wCount = dayVisits.filter(v => v.appointmentId === null).length;
    const aCount = dayVisits.filter(v => v.appointmentId !== null).length;
    const cCount = dayVisits.filter(v => v.status === 'COMPLETED').length;
    const cancCount = dayVisits.filter(v => v.status === 'CANCELLED').length;
    const newCount = dayVisits.filter(v => newPatientIds.has(v.patientId)).length;
    const existCount = vCount - newCount;

    const dayActive = dayVisits.filter(v => v.status !== 'CANCELLED');
    const dayDue = dayActive.reduce((sum, v) => sum + (v.amountDue || 0), 0);
    const dayCollected = paymentsByDay[dateStr] || 0;

    let dayOutstanding = 0;
    for (const v of dayActive) {
      const paid = v.payments.reduce((sum, p) => sum + p.amount, 0);
      dayOutstanding += Math.max(0, (v.amountDue || 0) - paid);
    }

    return {
      date: dateStr,
      visits: vCount,
      walkIns: wCount,
      appointments: aCount,
      newPatients: newCount,
      existingPatientVisits: existCount,
      completedVisits: cCount,
      cancelledVisits: cancCount,
      amountDue: Math.round(dayDue * 100) / 100,
      amountCollected: Math.round(dayCollected * 100) / 100,
      outstanding: Math.round(dayOutstanding * 100) / 100
    };
  });

  return {
    summary: {
      totalVisits,
      completedVisits,
      cancelledVisits,
      walkInVisits,
      appointmentVisits,
      newPatients,
      existingPatientVisits,
      totalAmountDue: Math.round(totalAmountDue * 100) / 100,
      totalAmountCollected: Math.round(totalAmountCollected * 100) / 100,
      outstandingAmount: Math.round(outstandingAmount * 100) / 100
    },
    trend: dailyTrend
  };
}

/**
 * 2. VISITS REPORT
 */
export interface VisitsFilterParams {
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  status?: string;
  visitType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function buildVisitsWhereClause(params: VisitsFilterParams) {
  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const where: any = {};
  if (dateFilter) where.createdAt = dateFilter;
  if (params.doctorId && params.doctorId !== 'all') where.doctorId = params.doctorId;
  if (params.status && params.status !== 'all') where.status = params.status;
  if (params.visitType === 'Walk-in') where.appointmentId = null;
  if (params.visitType === 'Appointment') where.appointmentId = { not: null };

  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    where.OR = [
      { id: { contains: s } },
      { reasonForVisit: { contains: s } },
      { patient: { name: { contains: s } } },
      { patient: { id: { contains: s } } }
    ];
  }

  return where;
}

export async function getVisitsReportData(params: VisitsFilterParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
  const skip = (page - 1) * limit;

  const where = buildVisitsWhereClause(params);

  // Summary counts for the filter criteria
  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const summaryWhere: any = {};
  const dateFilter = buildPrismaDateFilter(startDate, endDate);
  if (dateFilter) summaryWhere.createdAt = dateFilter;
  if (params.doctorId && params.doctorId !== 'all') summaryWhere.doctorId = params.doctorId;

  const [totalVisits, completed, cancelled, walkIns, appointments] = await Promise.all([
    prisma.visit.count({ where: summaryWhere }),
    prisma.visit.count({ where: { ...summaryWhere, status: 'COMPLETED' } }),
    prisma.visit.count({ where: { ...summaryWhere, status: 'CANCELLED' } }),
    prisma.visit.count({ where: { ...summaryWhere, appointmentId: null } }),
    prisma.visit.count({ where: { ...summaryWhere, appointmentId: { not: null } } })
  ]);

  const [visits, totalRecords] = await Promise.all([
    prisma.visit.findMany({
      where,
      skip,
      take: limit,
      include: {
        patient: { select: { id: true, name: true } },
        payments: { where: { status: 'Completed' }, select: { amount: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.visit.count({ where })
  ]);

  // Doctor names lookup
  const staffMembers = await prisma.staff.findMany({ select: { id: true, name: true } });
  const staffMap = new Map(staffMembers.map(s => [s.id, s.name]));

  const rows = visits.map(v => {
    const totalPaid = (v.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, (v.amountDue || 0) - totalPaid);
    return {
      id: v.id,
      visitDateTime: v.createdAt.toISOString(),
      patientId: v.patient?.id || v.patientId,
      patientName: v.patient?.name || 'Unknown',
      visitType: v.appointmentId ? 'Appointment' : 'Walk-in',
      doctorName: v.doctorId ? (staffMap.get(v.doctorId) || '—') : '—',
      reasonForVisit: v.reasonForVisit || '—',
      status: v.status,
      amountDue: v.amountDue || 0,
      totalPaid,
      balance
    };
  });

  return {
    summary: {
      totalVisits,
      completed,
      cancelled,
      walkIns,
      appointments
    },
    data: rows,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    }
  };
}

export async function getVisitsExportData(params: VisitsFilterParams) {
  const where = buildVisitsWhereClause(params);

  const visits = await prisma.visit.findMany({
    where,
    include: {
      patient: { select: { id: true, name: true } },
      payments: { where: { status: 'Completed' }, select: { amount: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const staffMembers = await prisma.staff.findMany({ select: { id: true, name: true } });
  const staffMap = new Map(staffMembers.map(s => [s.id, s.name]));

  return visits.map(v => {
    const totalPaid = (v.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, (v.amountDue || 0) - totalPaid);
    return {
      visitDateTime: new Date(v.createdAt).toLocaleString(),
      patientName: v.patient?.name || 'Unknown',
      patientId: v.patient?.id || v.patientId,
      visitType: v.appointmentId ? 'Appointment' : 'Walk-in',
      doctorName: v.doctorId ? (staffMap.get(v.doctorId) || '—') : '—',
      reasonForVisit: v.reasonForVisit || '—',
      status: v.status,
      amountDue: `₹${v.amountDue || 0}`,
      totalPaid: `₹${totalPaid}`,
      balance: `₹${balance}`
    };
  });
}

/**
 * 3. REVENUE / PAYMENTS REPORT
 */
export interface RevenueFilterParams {
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  method?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function buildRevenueWhereClause(params: RevenueFilterParams) {
  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const where: any = {};
  if (dateFilter) where.createdAt = dateFilter;
  if (params.method && params.method !== 'all') where.method = params.method;
  if (params.status && params.status !== 'all') where.status = params.status;
  if (params.doctorId && params.doctorId !== 'all') {
    where.visit = { doctorId: params.doctorId };
  }

  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    where.OR = [
      { id: { contains: s } },
      { visitId: { contains: s } },
      { notes: { contains: s } },
      { patient: { name: { contains: s } } },
      { patient: { id: { contains: s } } }
    ];
  }

  return where;
}

export async function getRevenueReportData(params: RevenueFilterParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
  const skip = (page - 1) * limit;

  const where = buildRevenueWhereClause(params);

  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  // Financial summary:
  // 1. Total Amount Due across non-cancelled visits in period
  const visitFilter: any = { status: { not: 'CANCELLED' } };
  if (dateFilter) visitFilter.createdAt = dateFilter;
  if (params.doctorId && params.doctorId !== 'all') visitFilter.doctorId = params.doctorId;

  const activeVisits = await prisma.visit.findMany({
    where: visitFilter,
    select: {
      id: true,
      amountDue: true,
      payments: {
        where: { status: 'Completed' },
        select: { amount: true }
      }
    }
  });

  const totalAmountDue = activeVisits.reduce((sum, v) => sum + (v.amountDue || 0), 0);
  let outstandingAmount = 0;
  let paidVisits = 0;
  let partialPaymentVisits = 0;
  let unpaidVisits = 0;

  for (const v of activeVisits) {
    const paid = v.payments.reduce((sum, p) => sum + p.amount, 0);
    const bal = Math.max(0, (v.amountDue || 0) - paid);
    outstandingAmount += bal;

    if ((v.amountDue || 0) > 0) {
      if (bal === 0) paidVisits++;
      else if (paid > 0 && bal > 0) partialPaymentVisits++;
      else unpaidVisits++;
    } else {
      paidVisits++;
    }
  }

  // Authoritative Total Collected directly from Payment
  const paymentScopeWhere: any = { status: 'Completed' };
  if (dateFilter) paymentScopeWhere.createdAt = dateFilter;
  if (params.doctorId && params.doctorId !== 'all') paymentScopeWhere.visit = { doctorId: params.doctorId };

  const totalCollectedAgg = await prisma.payment.aggregate({
    where: paymentScopeWhere,
    _sum: { amount: true }
  });
  const totalCollected = totalCollectedAgg._sum.amount || 0;

  // Payment method breakdown
  const methodGroup = await prisma.payment.groupBy({
    by: ['method'],
    where: paymentScopeWhere,
    _count: { id: true },
    _sum: { amount: true }
  });

  const methodBreakdown: Record<string, { transactionCount: number; amount: number }> = {
    'Cash': { transactionCount: 0, amount: 0 },
    'GPay': { transactionCount: 0, amount: 0 },
    'Credit Card': { transactionCount: 0, amount: 0 },
    'Debit Card': { transactionCount: 0, amount: 0 }
  };

  for (const mg of methodGroup) {
    methodBreakdown[mg.method] = {
      transactionCount: mg._count.id || 0,
      amount: mg._sum.amount || 0
    };
  }

  // Daily revenue trend
  const allPayments = await prisma.payment.findMany({
    where: paymentScopeWhere,
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  const revenueByDayMap: Record<string, number> = {};
  for (const p of allPayments) {
    const d = p.createdAt.toISOString().split('T')[0];
    revenueByDayMap[d] = (revenueByDayMap[d] || 0) + p.amount;
  }

  let trendDates: string[] = [];
  if (startDate && endDate) {
    trendDates = getDateArrayBetween(startDate, endDate);
  } else {
    trendDates = Object.keys(revenueByDayMap).sort();
  }

  const revenueTrend = trendDates.map(dateStr => ({
    date: dateStr,
    amountCollected: Math.round((revenueByDayMap[dateStr] || 0) * 100) / 100
  }));

  // Paginated detailed payment records
  const [payments, totalRecords] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        patient: { select: { id: true, name: true } },
        visit: { select: { id: true, doctorId: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.payment.count({ where })
  ]);

  const staffMembers = await prisma.staff.findMany({ select: { id: true, name: true } });
  const staffMap = new Map(staffMembers.map(s => [s.id, s.name]));

  const rows = payments.map(p => {
    const docId = p.visit?.doctorId;
    const docName = docId ? (staffMap.get(docId) || '—') : '—';
    return {
      paymentId: p.id,
      paymentDate: p.createdAt.toISOString(),
      patientId: p.patient?.id || p.patientId,
      patientName: p.patient?.name || 'Unknown',
      visitId: p.visitId,
      doctorName: docName,
      paymentMethod: p.method,
      amount: p.amount,
      paymentStatus: p.status,
      notes: p.notes || '—'
    };
  });

  return {
    summary: {
      totalAmountDue: Math.round(totalAmountDue * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      outstandingAmount: Math.round(outstandingAmount * 100) / 100,
      paidVisits,
      partialPaymentVisits,
      unpaidVisits
    },
    methodBreakdown,
    trend: revenueTrend,
    data: rows,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    }
  };
}

export async function getRevenueExportData(params: RevenueFilterParams) {
  const where = buildRevenueWhereClause(params);

  const payments = await prisma.payment.findMany({
    where,
    include: {
      patient: { select: { id: true, name: true } },
      visit: { select: { id: true, doctorId: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const staffMembers = await prisma.staff.findMany({ select: { id: true, name: true } });
  const staffMap = new Map(staffMembers.map(s => [s.id, s.name]));

  return payments.map(p => {
    const docId = p.visit?.doctorId;
    const docName = docId ? (staffMap.get(docId) || '—') : '—';
    return {
      paymentId: p.id,
      paymentDate: new Date(p.createdAt).toLocaleString(),
      patientName: p.patient?.name || 'Unknown',
      patientId: p.patient?.id || p.patientId,
      visitId: p.visitId,
      doctorName: docName,
      paymentMethod: p.method,
      amount: `₹${p.amount}`,
      paymentStatus: p.status,
      notes: p.notes || '—'
    };
  });
}

/**
 * 4. PATIENTS REPORT
 */
export interface PatientsFilterParams {
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getPatientsReportData(params: PatientsFilterParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
  const skip = (page - 1) * limit;

  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  // Filter visits to find active patients in period
  const visitWhere: any = {};
  if (dateFilter) visitWhere.createdAt = dateFilter;
  if (params.doctorId && params.doctorId !== 'all') visitWhere.doctorId = params.doctorId;

  // Find unique patients who had a visit in the requested period
  const visitsInPeriod = await prisma.visit.findMany({
    where: visitWhere,
    select: { patientId: true }
  });

  const activePatientIds = Array.from(new Set(visitsInPeriod.map(v => v.patientId)));

  const patientWhere: any = {
    id: { in: activePatientIds }
  };

  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    patientWhere.OR = [
      { name: { contains: s } },
      { phone: { contains: s } },
      { id: { contains: s } }
    ];
  }

  const [patients, totalRecords] = await Promise.all([
    prisma.patient.findMany({
      where: patientWhere,
      skip,
      take: limit,
      include: {
        visits: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.patient.count({ where: patientWhere })
  ]);

  // First visit analysis across all patients in this view
  const targetPatientIds = patients.map(p => p.id);
  const firstVisits = await prisma.visit.groupBy({
    by: ['patientId'],
    where: { patientId: { in: targetPatientIds } },
    _min: { createdAt: true },
    _count: { id: true }
  });
  const firstVisitMap = new Map(firstVisits.map(fv => [fv.patientId, { minDate: fv._min.createdAt, count: fv._count.id }]));

  const rows = patients.map(p => {
    const stats = firstVisitMap.get(p.id);
    const minDate = stats?.minDate;
    let patientType = 'Returning';
    if (minDate) {
      if (!startDate && !endDate) {
        patientType = 'New';
      } else {
        const afterStart = !startDate || minDate >= startDate;
        const beforeEnd = !endDate || minDate <= endDate;
        if (afterStart && beforeEnd) {
          patientType = 'New';
        }
      }
    }

    const lastVisit = p.visits[0]?.createdAt ? p.visits[0].createdAt.toISOString() : '—';

    return {
      patientId: p.id,
      patientName: p.name,
      phone: p.phone,
      age: p.age,
      gender: p.gender,
      patientType,
      totalVisitsAllTime: stats?.count || p.visits.length,
      lastVisitDate: lastVisit,
      registeredDate: p.createdAt.toISOString()
    };
  });

  return {
    data: rows,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    }
  };
}

export async function getPatientsExportData(params: PatientsFilterParams) {
  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const visitWhere: any = {};
  if (dateFilter) visitWhere.createdAt = dateFilter;
  if (params.doctorId && params.doctorId !== 'all') visitWhere.doctorId = params.doctorId;

  const visitsInPeriod = await prisma.visit.findMany({
    where: visitWhere,
    select: { patientId: true }
  });
  const activePatientIds = Array.from(new Set(visitsInPeriod.map(v => v.patientId)));

  const patientWhere: any = { id: { in: activePatientIds } };
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    patientWhere.OR = [
      { name: { contains: s } },
      { phone: { contains: s } },
      { id: { contains: s } }
    ];
  }

  const patients = await prisma.patient.findMany({
    where: patientWhere,
    include: {
      visits: {
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const firstVisits = await prisma.visit.groupBy({
    by: ['patientId'],
    where: { patientId: { in: patients.map(p => p.id) } },
    _min: { createdAt: true },
    _count: { id: true }
  });
  const firstVisitMap = new Map(firstVisits.map(fv => [fv.patientId, { minDate: fv._min.createdAt, count: fv._count.id }]));

  return patients.map(p => {
    const stats = firstVisitMap.get(p.id);
    const minDate = stats?.minDate;
    let patientType = 'Returning';
    if (minDate) {
      if (!startDate && !endDate) patientType = 'New';
      else {
        const afterStart = !startDate || minDate >= startDate;
        const beforeEnd = !endDate || minDate <= endDate;
        if (afterStart && beforeEnd) patientType = 'New';
      }
    }
    const lastVisit = p.visits[0]?.createdAt ? new Date(p.visits[0].createdAt).toLocaleDateString() : '—';

    return {
      patientId: p.id,
      patientName: p.name,
      phone: p.phone,
      age: p.age,
      gender: p.gender,
      patientType,
      totalVisitsAllTime: stats?.count || p.visits.length,
      lastVisitDate: lastVisit,
      registeredDate: new Date(p.createdAt).toLocaleDateString()
    };
  });
}

/**
 * 5. TREATMENTS REPORT
 */
export interface TreatmentsFilterParams {
  startDate?: string;
  endDate?: string;
  category?: string;
  status?: string; // 'Planned' | 'Completed' | 'all'
  search?: string;
  page?: number;
  limit?: number;
}

export async function getTreatmentsReportData(params: TreatmentsFilterParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
  const skip = (page - 1) * limit;

  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const plannedDateFilter = buildPrismaDateFilter(startDate, endDate);

  // Completed treatments MUST use completedAt!
  const completedDateFilter = buildPrismaDateFilter(startDate, endDate);

  // Fetch all TreatmentCatalog items with their items in period
  const catalogWhere: any = { isActive: true };
  if (params.category && params.category !== 'all') {
    catalogWhere.category = params.category;
  }
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    catalogWhere.OR = [
      { name: { contains: s } },
      { category: { contains: s } },
      { variant: { contains: s } },
      { planItems: { some: { notes: { contains: s } } } }
    ];
  }

  const [catalogs, totalRecords] = await Promise.all([
    prisma.treatmentCatalog.findMany({
      where: catalogWhere,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      skip,
      take: limit
    }),
    prisma.treatmentCatalog.count({ where: catalogWhere })
  ]);

  const catalogIds = catalogs.map(c => c.id);

  // Query planned items (status = 'Planned', createdAt in date range)
  const plannedWhere: any = {
    treatmentCatalogId: { in: catalogIds },
    status: 'Planned'
  };
  if (plannedDateFilter) plannedWhere.createdAt = plannedDateFilter;

  const plannedItems = await prisma.treatmentPlanItem.findMany({
    where: plannedWhere,
    select: { treatmentCatalogId: true, treatmentPlan: { select: { patientId: true } } }
  });

  // Query completed items (status = 'Completed', completedAt in date range)
  const completedWhere: any = {
    treatmentCatalogId: { in: catalogIds },
    status: 'Completed'
  };
  if (completedDateFilter) completedWhere.completedAt = completedDateFilter;

  const completedItems = await prisma.treatmentPlanItem.findMany({
    where: completedWhere,
    select: { treatmentCatalogId: true, treatmentPlan: { select: { patientId: true } } }
  });

  const plannedMap: Record<string, number> = {};
  const completedMap: Record<string, number> = {};
  const patientSets: Record<string, Set<string>> = {};

  plannedItems.forEach(item => {
    plannedMap[item.treatmentCatalogId] = (plannedMap[item.treatmentCatalogId] || 0) + 1;
    if (!patientSets[item.treatmentCatalogId]) patientSets[item.treatmentCatalogId] = new Set();
    if (item.treatmentPlan?.patientId) patientSets[item.treatmentCatalogId].add(item.treatmentPlan.patientId);
  });

  completedItems.forEach(item => {
    completedMap[item.treatmentCatalogId] = (completedMap[item.treatmentCatalogId] || 0) + 1;
    if (!patientSets[item.treatmentCatalogId]) patientSets[item.treatmentCatalogId] = new Set();
    if (item.treatmentPlan?.patientId) patientSets[item.treatmentCatalogId].add(item.treatmentPlan.patientId);
  });

  const rows = catalogs.map(c => ({
    id: c.id,
    category: c.category,
    treatmentName: c.name,
    variant: c.variant || '—',
    plannedCount: plannedMap[c.id] || 0,
    completedCount: completedMap[c.id] || 0,
    uniquePatients: patientSets[c.id]?.size || 0
  }));

  // Overall totals
  const totalPlanned = plannedItems.length;
  const totalCompleted = completedItems.length;

  return {
    summary: {
      totalPlanned,
      totalCompleted
    },
    data: rows,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    }
  };
}

export async function getTreatmentsExportData(params: TreatmentsFilterParams) {
  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const catalogWhere: any = { isActive: true };
  if (params.category && params.category !== 'all') catalogWhere.category = params.category;
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    catalogWhere.OR = [
      { name: { contains: s } },
      { category: { contains: s } },
      { variant: { contains: s } },
      { planItems: { some: { notes: { contains: s } } } }
    ];
  }

  const catalogs = await prisma.treatmentCatalog.findMany({
    where: catalogWhere,
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  });

  const catalogIds = catalogs.map(c => c.id);

  const plannedWhere: any = { treatmentCatalogId: { in: catalogIds }, status: 'Planned' };
  if (dateFilter) plannedWhere.createdAt = dateFilter;
  const plannedItems = await prisma.treatmentPlanItem.findMany({
    where: plannedWhere,
    select: { treatmentCatalogId: true, treatmentPlan: { select: { patientId: true } } }
  });

  const completedWhere: any = { treatmentCatalogId: { in: catalogIds }, status: 'Completed' };
  if (dateFilter) completedWhere.completedAt = dateFilter;
  const completedItems = await prisma.treatmentPlanItem.findMany({
    where: completedWhere,
    select: { treatmentCatalogId: true, treatmentPlan: { select: { patientId: true } } }
  });

  const plannedMap: Record<string, number> = {};
  const completedMap: Record<string, number> = {};
  const patientSets: Record<string, Set<string>> = {};

  plannedItems.forEach(i => {
    plannedMap[i.treatmentCatalogId] = (plannedMap[i.treatmentCatalogId] || 0) + 1;
    if (!patientSets[i.treatmentCatalogId]) patientSets[i.treatmentCatalogId] = new Set();
    if (i.treatmentPlan?.patientId) patientSets[i.treatmentCatalogId].add(i.treatmentPlan.patientId);
  });
  completedItems.forEach(i => {
    completedMap[i.treatmentCatalogId] = (completedMap[i.treatmentCatalogId] || 0) + 1;
    if (!patientSets[i.treatmentCatalogId]) patientSets[i.treatmentCatalogId] = new Set();
    if (i.treatmentPlan?.patientId) patientSets[i.treatmentCatalogId].add(i.treatmentPlan.patientId);
  });

  return catalogs.map(c => ({
    category: c.category,
    treatmentName: c.name,
    variant: c.variant || '—',
    plannedCount: plannedMap[c.id] || 0,
    completedCount: completedMap[c.id] || 0,
    uniquePatients: patientSets[c.id]?.size || 0
  }));
}

/**
 * 6. DOCTOR ACTIVITY REPORT
 */
export async function getDoctorActivityReportData(startDateStr?: string, endDateStr?: string) {
  const { startDate, endDate } = parseDateRange(startDateStr, endDateStr);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const doctors = await prisma.staff.findMany({
    where: {
      role: { in: ['Head Doctor', 'Duty Doctor'] }
    },
    orderBy: { name: 'asc' }
  });

  const visitWhere: any = {
    doctorId: { in: doctors.map(d => d.id) }
  };
  if (dateFilter) visitWhere.createdAt = dateFilter;

  const visits = await prisma.visit.findMany({
    where: visitWhere,
    select: {
      id: true,
      doctorId: true,
      patientId: true,
      status: true,
      createdAt: true
    }
  });

  // Calculate new vs returning per doctor using first-ever visit logic
  const patientIds = Array.from(new Set(visits.map(v => v.patientId)));
  const firstVisits = await prisma.visit.groupBy({
    by: ['patientId'],
    where: { patientId: { in: patientIds } },
    _min: { createdAt: true }
  });
  const firstVisitMap = new Map(firstVisits.map(fv => [fv.patientId, fv._min.createdAt]));

  const newPatientSetByDoc: Record<string, Set<string>> = {};
  const returningPatientSetByDoc: Record<string, Set<string>> = {};
  const completedByDoc: Record<string, number> = {};
  const cancelledByDoc: Record<string, number> = {};
  const totalByDoc: Record<string, number> = {};

  doctors.forEach(d => {
    newPatientSetByDoc[d.id] = new Set();
    returningPatientSetByDoc[d.id] = new Set();
    completedByDoc[d.id] = 0;
    cancelledByDoc[d.id] = 0;
    totalByDoc[d.id] = 0;
  });

  visits.forEach(v => {
    if (!v.doctorId) return;
    totalByDoc[v.doctorId] = (totalByDoc[v.doctorId] || 0) + 1;
    if (v.status === 'COMPLETED') completedByDoc[v.doctorId] = (completedByDoc[v.doctorId] || 0) + 1;
    if (v.status === 'CANCELLED') cancelledByDoc[v.doctorId] = (cancelledByDoc[v.doctorId] || 0) + 1;

    const minDate = firstVisitMap.get(v.patientId);
    let isNew = false;
    if (minDate) {
      if (!startDate && !endDate) isNew = true;
      else {
        const afterStart = !startDate || minDate >= startDate;
        const beforeEnd = !endDate || minDate <= endDate;
        if (afterStart && beforeEnd) isNew = true;
      }
    }

    if (isNew) {
      newPatientSetByDoc[v.doctorId]?.add(v.patientId);
    } else {
      returningPatientSetByDoc[v.doctorId]?.add(v.patientId);
    }
  });

  return doctors.map(d => ({
    doctorId: d.id,
    doctorName: d.name,
    role: d.role,
    totalAssignedVisits: totalByDoc[d.id] || 0,
    newPatientsSeen: newPatientSetByDoc[d.id]?.size || 0,
    returningPatientsSeen: returningPatientSetByDoc[d.id]?.size || 0,
    completedVisits: completedByDoc[d.id] || 0,
    cancelledVisits: cancelledByDoc[d.id] || 0
  }));
}

/**
 * 7. MEDICINE DISPENSING REPORT
 */
export interface MedicineReportFilterParams {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  medicineId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getMedicinesReportData(params: MedicineReportFilterParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
  const skip = (page - 1) * limit;

  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const medWhere: any = {};
  if (params.categoryId && params.categoryId !== 'all') medWhere.categoryId = params.categoryId;
  if (params.medicineId && params.medicineId !== 'all') medWhere.id = params.medicineId;
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    medWhere.OR = [
      { name: { contains: s } },
      { genericName: { contains: s } }
    ];
  }

  const [medicines, totalRecords] = await Promise.all([
    prisma.medicine.findMany({
      where: medWhere,
      include: { category: true },
      orderBy: { name: 'asc' },
      skip,
      take: limit
    }),
    prisma.medicine.count({ where: medWhere })
  ]);

  const medicineIds = medicines.map(m => m.id);

  // Dispensing items in period (Dispensing.createdAt)
  const dispWhere: any = {
    medicineId: { in: medicineIds }
  };
  if (dateFilter) dispWhere.dispensing = { createdAt: dateFilter };

  const dispItems = await prisma.dispensingItem.findMany({
    where: dispWhere,
    select: {
      medicineId: true,
      prescribedQuantity: true,
      dispensedQuantity: true,
      dispensingId: true
    }
  });

  const dispensedQtyMap: Record<string, number> = {};
  const prescribedQtyMap: Record<string, number> = {};
  const txSets: Record<string, Set<string>> = {};

  dispItems.forEach(item => {
    dispensedQtyMap[item.medicineId] = (dispensedQtyMap[item.medicineId] || 0) + item.dispensedQuantity;
    prescribedQtyMap[item.medicineId] = (prescribedQtyMap[item.medicineId] || 0) + item.prescribedQuantity;
    if (!txSets[item.medicineId]) txSets[item.medicineId] = new Set();
    txSets[item.medicineId].add(item.dispensingId);
  });

  const rows = medicines.map(m => ({
    id: m.id,
    medicineName: m.name,
    genericName: m.genericName || '—',
    category: m.category?.name || '—',
    totalPrescribedQuantity: prescribedQtyMap[m.id] || 0,
    totalDispensedQuantity: dispensedQtyMap[m.id] || 0,
    dispensingTransactions: txSets[m.id]?.size || 0,
    currentStock: m.currentStock
  }));

  // Summary counts across all medicines in date range
  const allDispWhere: any = {};
  if (dateFilter) allDispWhere.dispensing = { createdAt: dateFilter };

  const totalDispensedAgg = await prisma.dispensingItem.aggregate({
    where: allDispWhere,
    _sum: { dispensedQuantity: true }
  });

  return {
    summary: {
      totalDispensedUnits: totalDispensedAgg._sum.dispensedQuantity || 0
    },
    data: rows,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    }
  };
}

export async function getMedicinesExportData(params: MedicineReportFilterParams) {
  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const medWhere: any = {};
  if (params.categoryId && params.categoryId !== 'all') medWhere.categoryId = params.categoryId;
  if (params.medicineId && params.medicineId !== 'all') medWhere.id = params.medicineId;
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    medWhere.OR = [
      { name: { contains: s } },
      { genericName: { contains: s } }
    ];
  }

  const medicines = await prisma.medicine.findMany({
    where: medWhere,
    include: { category: true },
    orderBy: { name: 'asc' }
  });

  const dispWhere: any = { medicineId: { in: medicines.map(m => m.id) } };
  if (dateFilter) dispWhere.dispensing = { createdAt: dateFilter };

  const dispItems = await prisma.dispensingItem.findMany({
    where: dispWhere,
    select: {
      medicineId: true,
      prescribedQuantity: true,
      dispensedQuantity: true,
      dispensingId: true
    }
  });

  const dispensedQtyMap: Record<string, number> = {};
  const prescribedQtyMap: Record<string, number> = {};
  const txSets: Record<string, Set<string>> = {};

  dispItems.forEach(item => {
    dispensedQtyMap[item.medicineId] = (dispensedQtyMap[item.medicineId] || 0) + item.dispensedQuantity;
    prescribedQtyMap[item.medicineId] = (prescribedQtyMap[item.medicineId] || 0) + item.prescribedQuantity;
    if (!txSets[item.medicineId]) txSets[item.medicineId] = new Set();
    txSets[item.medicineId].add(item.dispensingId);
  });

  return medicines.map(m => ({
    medicineName: m.name,
    genericName: m.genericName || '—',
    category: m.category?.name || '—',
    totalPrescribedQuantity: prescribedQtyMap[m.id] || 0,
    totalDispensedQuantity: dispensedQtyMap[m.id] || 0,
    dispensingTransactions: txSets[m.id]?.size || 0,
    currentStock: m.currentStock
  }));
}

/**
 * 8. INVENTORY MOVEMENTS REPORT
 */
export interface InventoryMovementsFilterParams {
  startDate?: string;
  endDate?: string;
  medicineId?: string;
  movementType?: string; // 'PURCHASE_RECEIPT' | 'DISPENSING' | 'ADJUSTMENT' | 'all'
  page?: number;
  limit?: number;
}

export function buildInventoryWhereClause(params: InventoryMovementsFilterParams) {
  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const where: any = {};
  if (dateFilter) where.createdAt = dateFilter;
  if (params.medicineId && params.medicineId !== 'all') where.medicineId = params.medicineId;
  if (params.movementType && params.movementType !== 'all') where.movementType = params.movementType;
  return where;
}

export async function getInventoryMovementsReportData(params: InventoryMovementsFilterParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
  const skip = (page - 1) * limit;

  const where = buildInventoryWhereClause(params);

  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  // Summary counts for movements in window
  const summaryWhere: any = {};
  if (dateFilter) summaryWhere.createdAt = dateFilter;
  if (params.medicineId && params.medicineId !== 'all') summaryWhere.medicineId = params.medicineId;

  const [receiptsAgg, dispensingAgg, adjustmentAgg, adjustmentCount] = await Promise.all([
    prisma.stockMovement.aggregate({
      where: { ...summaryWhere, movementType: 'PURCHASE_RECEIPT' },
      _sum: { quantity: true }
    }),
    prisma.stockMovement.aggregate({
      where: { ...summaryWhere, movementType: 'DISPENSING' },
      _sum: { quantity: true }
    }),
    prisma.stockMovement.aggregate({
      where: { ...summaryWhere, movementType: 'ADJUSTMENT' },
      _sum: { quantity: true }
    }),
    prisma.stockMovement.count({
      where: { ...summaryWhere, movementType: 'ADJUSTMENT' }
    })
  ]);

  const stockReceived = receiptsAgg._sum.quantity || 0;
  const stockDispensed = Math.abs(dispensingAgg._sum.quantity || 0);
  const netAdjustmentQuantity = adjustmentAgg._sum.quantity || 0;

  const [movements, totalRecords] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      include: { medicine: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.stockMovement.count({ where })
  ]);

  const rows = movements.map(m => ({
    id: m.id,
    dateTime: m.createdAt.toISOString(),
    medicineName: m.medicine?.name || 'Unknown',
    movementType: m.movementType,
    quantity: m.quantity,
    balanceAfter: m.balanceAfter,
    referenceType: m.referenceType || '—',
    referenceId: m.referenceId || '—',
    performedBy: m.performedBy || 'Staff',
    reason: m.reason || '—'
  }));

  return {
    summary: {
      stockReceived,
      stockDispensed,
      adjustmentCount,
      netAdjustmentQuantity
    },
    data: rows,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    }
  };
}

export async function getInventoryMovementsExportData(params: InventoryMovementsFilterParams) {
  const where = buildInventoryWhereClause(params);

  const movements = await prisma.stockMovement.findMany({
    where,
    include: { medicine: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return movements.map(m => ({
    dateTime: new Date(m.createdAt).toLocaleString(),
    medicineName: m.medicine?.name || 'Unknown',
    movementType: m.movementType,
    quantity: m.quantity > 0 ? `+${m.quantity}` : `${m.quantity}`,
    balanceAfter: m.balanceAfter,
    referenceType: m.referenceType || '—',
    referenceId: m.referenceId || '—',
    performedBy: m.performedBy || 'Staff',
    reason: m.reason || '—'
  }));
}

/**
 * 9. PROCUREMENT / PURCHASE ORDERS REPORT
 */
export interface ProcurementFilterParams {
  startDate?: string;
  endDate?: string;
  supplierId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function buildProcurementWhereClause(params: ProcurementFilterParams) {
  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const where: any = {};
  if (dateFilter) where.orderDate = dateFilter;
  if (params.supplierId && params.supplierId !== 'all') where.supplierId = params.supplierId;
  if (params.status && params.status !== 'all') where.status = params.status;
  return where;
}

export async function getProcurementReportData(params: ProcurementFilterParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
  const skip = (page - 1) * limit;

  const where = buildProcurementWhereClause(params);

  const { startDate, endDate } = parseDateRange(params.startDate, params.endDate);
  const dateFilter = buildPrismaDateFilter(startDate, endDate);

  const summaryWhere: any = {};
  if (dateFilter) summaryWhere.orderDate = dateFilter;
  if (params.supplierId && params.supplierId !== 'all') summaryWhere.supplierId = params.supplierId;

  const [totalPOs, draftPOs, orderedPOs, partiallyReceivedPOs, receivedPOs, cancelledPOs] = await Promise.all([
    prisma.purchaseOrder.count({ where: summaryWhere }),
    prisma.purchaseOrder.count({ where: { ...summaryWhere, status: 'Draft' } }),
    prisma.purchaseOrder.count({ where: { ...summaryWhere, status: 'Ordered' } }),
    prisma.purchaseOrder.count({ where: { ...summaryWhere, status: 'Partially Received' } }),
    prisma.purchaseOrder.count({ where: { ...summaryWhere, status: 'Received' } }),
    prisma.purchaseOrder.count({ where: { ...summaryWhere, status: 'Cancelled' } })
  ]);

  const [orders, totalRecords] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limit,
      include: {
        supplier: true,
        items: true
      },
      orderBy: { orderDate: 'desc' }
    }),
    prisma.purchaseOrder.count({ where })
  ]);

  const rows = orders.map(po => {
    const orderedQuantity = po.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
    const receivedQuantity = po.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
    const totalCostValue = po.items.reduce((sum, item) => sum + (item.orderedQuantity * item.unitCost), 0);

    return {
      id: po.id,
      orderNumber: po.orderNumber,
      supplierName: po.supplier?.name || '—',
      orderDate: po.orderDate.toISOString(),
      lineItemsCount: po.items.length,
      orderedQuantity,
      receivedQuantity,
      totalCostValue: Math.round(totalCostValue * 100) / 100,
      status: po.status
    };
  });

  // Supplier procurement summary
  const suppliers = await prisma.supplier.findMany({
    where: params.supplierId && params.supplierId !== 'all' ? { id: params.supplierId } : {},
    include: {
      purchaseOrders: {
        where: dateFilter ? { orderDate: dateFilter } : {},
        include: { items: true },
        orderBy: { orderDate: 'desc' }
      }
    }
  });

  const supplierSummaries = suppliers.map(s => {
    const pos = s.purchaseOrders || [];
    let itemsOrdered = 0;
    let itemsReceived = 0;
    let purchaseValue = 0;

    pos.forEach(po => {
      po.items.forEach(item => {
        itemsOrdered += item.orderedQuantity;
        itemsReceived += item.receivedQuantity;
        purchaseValue += (item.orderedQuantity * item.unitCost);
      });
    });

    const lastOrderDate = pos[0]?.orderDate ? pos[0].orderDate.toISOString() : null;

    return {
      supplierId: s.id,
      supplierName: s.name,
      contactPerson: s.contactPerson || '—',
      phone: s.phone || '—',
      totalPOs: pos.length,
      totalItemsOrdered: itemsOrdered,
      totalItemsReceived: itemsReceived,
      totalPurchaseValue: Math.round(purchaseValue * 100) / 100,
      lastOrderDate
    };
  });

  // Financial metrics for Supplier Bills & Payments respecting respective date fields (Corrections 4, 6, 11)
  const billDateFilter = buildPrismaDateFilter(startDate, endDate);
  const billWhere: any = {
    status: { not: 'Cancelled' }
  };
  if (billDateFilter) billWhere.invoiceDate = billDateFilter;
  if (params.supplierId && params.supplierId !== 'all') billWhere.supplierId = params.supplierId;

  const paymentDateFilter = buildPrismaDateFilter(startDate, endDate);
  const paymentWhere: any = {};
  if (paymentDateFilter) paymentWhere.date = paymentDateFilter;
  if (params.supplierId && params.supplierId !== 'all') paymentWhere.bill = { supplierId: params.supplierId };

  const [allBillsInPeriod, allPaymentsInPeriod, allUncancelledBills] = await Promise.all([
    prisma.supplierBill.findMany({
      where: billWhere,
      include: { payments: true }
    }),
    prisma.supplierPayment.findMany({
      where: paymentWhere,
      include: { bill: { include: { supplier: true } } }
    }),
    // All uncancelled bills ever (for accurate global/supplier outstanding payable balance)
    prisma.supplierBill.findMany({
      where: {
        status: { not: 'Cancelled' },
        ...(params.supplierId && params.supplierId !== 'all' ? { supplierId: params.supplierId } : {})
      },
      include: { payments: true }
    })
  ]);

  const totalBilledAmount = allBillsInPeriod.reduce((sum, b) => sum + b.amount, 0);
  const totalPaidAmount = allPaymentsInPeriod.reduce((sum, p) => sum + p.amount, 0);

  // Overall outstanding payable balance across active bills
  const totalEverBilled = allUncancelledBills.reduce((sum, b) => sum + b.amount, 0);
  const totalEverPaid = allUncancelledBills.reduce((sum, b) => sum + b.payments.reduce((pSum, p) => pSum + p.amount, 0), 0);
  const totalOutstandingBalance = Math.max(0, Math.round((totalEverBilled - totalEverPaid) * 100) / 100);

  // Status breakdown of bills in period
  const billStatusCounts = {
    Unpaid: allBillsInPeriod.filter(b => b.status === 'Unpaid').length,
    Partial: allBillsInPeriod.filter(b => b.status === 'Partial').length,
    Paid: allBillsInPeriod.filter(b => b.status === 'Paid').length
  };

  // Payment methods breakdown in period
  const paymentMethodBreakdown: Record<string, number> = {};
  allPaymentsInPeriod.forEach(p => {
    paymentMethodBreakdown[p.method] = (paymentMethodBreakdown[p.method] || 0) + p.amount;
  });

  return {
    summary: {
      totalPOs,
      draftPOs,
      orderedPOs,
      partiallyReceivedPOs,
      receivedPOs,
      cancelledPOs,
      // Phase C financial metrics
      totalBillsCount: allBillsInPeriod.length,
      totalBilledAmount: Math.round(totalBilledAmount * 100) / 100,
      totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
      totalOutstandingBalance,
      billStatusCounts,
      paymentMethodBreakdown
    },
    data: rows,
    bills: allBillsInPeriod.map(b => {
      const bPaid = b.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        id: b.id,
        invoiceNumber: b.invoiceNumber,
        invoiceDate: b.invoiceDate.toISOString(),
        supplierId: b.supplierId,
        amount: b.amount,
        totalPaid: Math.round(bPaid * 100) / 100,
        balance: Math.max(0, Math.round((b.amount - bPaid) * 100) / 100),
        status: b.status,
        purchaseOrderId: b.purchaseOrderId
      };
    }),
    payments: allPaymentsInPeriod.map(p => ({
      id: p.id,
      billId: p.supplierBillId,
      invoiceNumber: p.bill.invoiceNumber,
      supplierName: p.bill.supplier?.name || '—',
      amount: p.amount,
      method: p.method,
      date: p.date.toISOString(),
      notes: p.notes
    })),
    supplierSummary: supplierSummaries,
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    }
  };
}

export async function getProcurementExportData(params: ProcurementFilterParams) {
  const where = buildProcurementWhereClause(params);

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: true,
      items: true
    },
    orderBy: { orderDate: 'desc' }
  });

  return orders.map(po => {
    const orderedQuantity = po.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
    const receivedQuantity = po.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
    const totalCostValue = po.items.reduce((sum, item) => sum + (item.orderedQuantity * item.unitCost), 0);

    return {
      orderNumber: po.orderNumber,
      supplierName: po.supplier?.name || '—',
      orderDate: new Date(po.orderDate).toLocaleDateString(),
      lineItemsCount: po.items.length,
      orderedQuantity,
      receivedQuantity,
      totalCostValue: `₹${Math.round(totalCostValue * 100) / 100}`,
      status: po.status
    };
  });
}
