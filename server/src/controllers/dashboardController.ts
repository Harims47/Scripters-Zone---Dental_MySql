import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

/**
 * Controller providing consolidated, authoritative, role-aware daily clinic operations data.
 * Adheres strictly to Phase E:
 * - Date-targeted boundaries (today's startOfDay to endOfDay)
 * - Visit.status === 'READY_FOR_RECEPTION' as the sole authoritative ready-for-reception state
 * - Pending balances derived from authoritative Visit amountDue and Payment sums (not stale frontend state)
 * - Today's collections strictly calculated from Payment records (SupplierPayment is completely excluded)
 * - Doctor availability determined by attendance status and active consultation presence
 * - Zero new DB models introduced
 */
export const getDashboardData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const role = user?.role || 'Receptionist';
    const staffId = user?.staffId;

    // Determine clinic calendar today boundaries (local date start to end)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const todayDateStr = now.toISOString().split('T')[0];

    // Parallel fetch of foundational date-targeted data
    const [
      waitingQueueEntries,
      inProgressQueueEntries,
      calledQueueEntries,
      todayAppointments,
      readyForReceptionVisits,
      activeVisitsWithPayments,
      todayPaymentsAggregate,
      todayCompletedVisits,
      allDoctors
    ] = await Promise.all([
      // 1. Waiting Queue Entries for today (Waiting status and active Visit)
      prisma.queueEntry.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: 'Waiting',
          visit: {
            status: { not: 'CANCELLED' }
          }
        },
        orderBy: { position: 'asc' },
        include: {
          visit: {
            include: {
              patient: {
                select: { id: true, name: true, phone: true, gender: true, age: true }
              }
            }
          }
        }
      }),

      // 2. In Progress / With Doctor queue entries (for doctor workload and doctor status)
      prisma.queueEntry.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: { in: ['In Progress', 'With Doctor'] },
          visit: {
            status: { notIn: ['CANCELLED', 'COMPLETED'] }
          }
        },
        include: {
          visit: {
            include: {
              patient: {
                select: { id: true, name: true, phone: true }
              }
            }
          }
        }
      }),

      // 3. Called queue entries (for Duty Doctor next patient alert)
      prisma.queueEntry.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: 'Called',
          visit: {
            status: { not: 'CANCELLED' }
          }
        },
        include: {
          visit: {
            include: {
              patient: {
                select: { id: true, name: true, phone: true }
              }
            }
          }
        }
      }),

      // 4. Today's Appointments (Scheduled or Confirmed)
      prisma.appointment.findMany({
        where: {
          date: todayDateStr,
          status: { notIn: ['Cancelled', 'No Show'] }
        },
        orderBy: { time: 'asc' }
      }),

      // 5. Ready for Reception visits (authoritative: Visit.status === 'READY_FOR_RECEPTION')
      prisma.visit.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: 'READY_FOR_RECEPTION'
        },
        include: {
          patient: {
            select: { id: true, name: true, phone: true }
          }
        }
      }),

      // 6. Active visits with payments to compute authoritative outstanding pending balances
      prisma.visit.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: { notIn: ['CANCELLED'] }
        },
        include: {
          payments: {
            select: { amount: true, status: true }
          }
        }
      }),

      // 7. Today's Collections: strictly Patient Payment records completed or paid today (NOT SupplierPayment)
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: { not: 'Failed' }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      }),

      // 8. Completed visits today
      prisma.visit.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: 'COMPLETED'
        },
        select: { id: true, doctorId: true }
      }),

      // 9. All active Doctors in Staff
      prisma.staff.findMany({
        where: {
          role: { in: ['Head Doctor', 'Duty Doctor'] },
          status: 'Active'
        },
        select: { id: true, name: true, role: true, attendance: true, roomNumber: true }
      })
    ]);

    // Fetch patient info for appointments
    const appointmentPatientIds = Array.from(new Set(todayAppointments.map(a => a.patientId)));
    const appointmentPatients = await prisma.patient.findMany({
      where: { id: { in: appointmentPatientIds } },
      select: { id: true, name: true, phone: true }
    });
    const patientMap = new Map(appointmentPatients.map(p => [p.id, p]));

    // Doctor map for resolving doctor names
    const doctorMap = new Map(allDoctors.map(d => [d.id, d]));

    // Calculate Authoritative Pending Balances across visits
    let totalPendingBalance = 0;
    let pendingPaymentsCount = 0;
    activeVisitsWithPayments.forEach(v => {
      const totalPaid = v.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const balance = (v.amountDue || 0) - totalPaid;
      if (balance > 0 && v.status !== 'COMPLETED') {
        totalPendingBalance += balance;
        pendingPaymentsCount++;
      }
    });

    // Build Doctor Availability items
    const doctorAvailability = allDoctors.map(doc => {
      const activeConsultation = inProgressQueueEntries.find(q => q.assignedDoctorId === doc.id);
      let status: 'Available' | 'With Patient' | 'On Break' | 'Off Duty' = 'Available';

      if (doc.attendance === 'Leave' || doc.attendance === 'Absent') {
        status = 'Off Duty';
      } else if (activeConsultation) {
        status = 'With Patient';
      } else {
        status = 'Available';
      }

      return {
        id: doc.id,
        name: doc.name,
        role: doc.role,
        attendance: doc.attendance,
        roomNumber: doc.roomNumber || null,
        status,
        currentPatient: activeConsultation ? {
          patientName: activeConsultation.visit?.patient?.name || 'Patient',
          visitId: activeConsultation.visitId
        } : null
      };
    });

    // Format Waiting Queue entries
    const waitingPatients = waitingQueueEntries.map((q, idx) => {
      const doc = q.assignedDoctorId ? doctorMap.get(q.assignedDoctorId) : null;
      const createdAtTime = new Date(q.createdAt).getTime();
      const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAtTime) / (60 * 1000)));

      return {
        id: q.id,
        visitId: q.visitId,
        patientId: q.patientId,
        patientName: q.visit?.patient?.name || 'Unknown Patient',
        patientPhone: q.visit?.patient?.phone || '',
        visitType: q.visit?.reasonForVisit ? 'Walk-in' : 'General',
        reason: q.visit?.reasonForVisit || 'General Consultation',
        priority: q.priority,
        arrivalTime: q.arrivalTime,
        waitingSinceMinutes: elapsedMinutes,
        position: q.position || idx + 1,
        assignedDoctorId: q.assignedDoctorId || null,
        doctorName: doc ? doc.name : null
      };
    });

    // Format Appointments
    const formattedAppointments = todayAppointments.map(a => {
      const p = patientMap.get(a.patientId);
      const doc = a.providerId ? doctorMap.get(a.providerId) : null;
      return {
        id: a.id,
        patientId: a.patientId,
        patientName: p ? p.name : 'Unknown Patient',
        patientPhone: p ? p.phone : '',
        time: a.time,
        type: a.type,
        status: a.status,
        providerId: a.providerId || null,
        doctorName: doc ? doc.name : (a.providerId || 'Any Available')
      };
    });

    // Format Ready for Reception patients
    const readyForReceptionList = readyForReceptionVisits.map(v => ({
      visitId: v.id,
      patientId: v.patientId,
      patientName: v.patient?.name || 'Unknown',
      patientPhone: v.patient?.phone || '',
      amountDue: v.amountDue
    }));

    // Duty Doctor Specific Slice
    let dutyDoctorData = null;
    if (staffId) {
      const myWaiting = waitingPatients.filter(q => q.assignedDoctorId === staffId);
      const myActive = inProgressQueueEntries.find(q => q.assignedDoctorId === staffId);
      const myCalled = calledQueueEntries.find(q => q.assignedDoctorId === staffId);
      const myCompletedCount = todayCompletedVisits.filter(v => v.doctorId === staffId).length;

      // Active or called patient to present prominently
      const currentPatientEntry = myActive || myCalled;

      dutyDoctorData = {
        myWaitingPatients: myWaiting,
        myWaitingCount: myWaiting.length,
        currentPatient: currentPatientEntry ? {
          queueId: currentPatientEntry.id,
          visitId: currentPatientEntry.visitId,
          patientId: currentPatientEntry.patientId,
          patientName: currentPatientEntry.visit?.patient?.name || 'Patient',
          patientPhone: currentPatientEntry.visit?.patient?.phone || '',
          status: currentPatientEntry.status
        } : null,
        completedTodayCount: myCompletedCount,
        consultationsTodayCount: myCompletedCount + (myActive ? 1 : 0)
      };
    }

    // Consolidated KPI counts
    const kpis = {
      waitingNowCount: waitingPatients.length,
      todayAppointmentsCount: formattedAppointments.length,
      readyForReceptionCount: readyForReceptionList.length,
      pendingPaymentsCount,
      totalPendingBalance,
      todayCollectionsAmount: todayPaymentsAggregate._sum.amount || 0,
      todayCollectionsCount: todayPaymentsAggregate._count.id || 0,
      withDoctorsCount: inProgressQueueEntries.length,
      completedTodayCount: todayCompletedVisits.length,
      totalVisitsToday: activeVisitsWithPayments.length
    };

    return res.json({
      role,
      date: todayDateStr,
      kpis,
      waitingPatients,
      todayAppointments: formattedAppointments,
      readyForReception: readyForReceptionList,
      doctorAvailability,
      dutyDoctor: dutyDoctorData
    });
  } catch (error) {
    next(error);
  }
};
