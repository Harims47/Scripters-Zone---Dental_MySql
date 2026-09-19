import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const queue = await prisma.queueEntry.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      orderBy: { position: 'asc' },
      include: { visit: { include: { patient: true } } }
    });

    const sanitizedQueue = req.user?.role === 'Receptionist'
      ? queue.map((entry: any) => {
          if (entry.visit?.paymentOwner === 'DOCTOR') {
            return {
              ...entry,
              visit: {
                ...entry.visit,
                amountDue: 0,
                consultationFee: null,
                treatmentFee: null,
                medicineCost: null,
              }
            };
          }
          return entry;
        })
      : queue;

    return res.json(sanitizedQueue);
  } catch (error) {
    next(error);
  }
};

export const getQueueEntryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const entry = await prisma.queueEntry.findUnique({
      where: { id },
      include: { visit: true }
    }) as any;
    if (!entry) return res.status(404).json({ error: 'Queue entry not found' });

    if (req.user?.role === 'Receptionist' && entry.visit?.paymentOwner === 'DOCTOR') {
      entry.visit.amountDue = 0;
      entry.visit.consultationFee = null;
      entry.visit.treatmentFee = null;
      entry.visit.medicineCost = null;
    }

    return res.json(entry);
  } catch (error) {
    next(error);
  }
};

export const transitionQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { action } = req.body;
    
    // Authorization checks based on action
    const userRole = (req as any).user.role;
    
    if (action === 'CALL_PATIENT') {
      if (!['Head Doctor', 'Receptionist'].includes(userRole)) {
        return res.status(403).json({ error: 'Unauthorized to call patient' });
      }
    } else if (action === 'START_CONSULTATION') {
      if (!['Head Doctor', 'Duty Doctor'].includes(userRole)) {
        return res.status(403).json({ error: 'Unauthorized to start consultation' });
      }
    }

    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id },
      include: { visit: true }
    });
    
    if (!queueEntry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    const visit = queueEntry.visit;

    // Allowed Visit Transitions Dictionary (from frontend visit-status.ts)
    const allowedTransitions: Record<string, string[]> = {
      'ARRIVED': ['WAITING', 'CANCELLED'],
      'WAITING': ['CALLED', 'WITH_DOCTOR', 'CANCELLED'],
      'CALLED': ['WITH_DOCTOR', 'WAITING', 'CANCELLED'],
      'WITH_DOCTOR': ['READY_FOR_RECEPTION', 'READY_FOR_PAYMENT', 'COMPLETED'],
      'READY_FOR_RECEPTION': ['READY_FOR_PAYMENT'],
      'READY_FOR_PAYMENT': ['PAID'],
      'PAID': ['COMPLETED'],
      'COMPLETED': [],
      'CANCELLED': []
    };

    let targetVisitStatus = visit.status;
    let targetQueueStatus = queueEntry.status;

    if (action === 'CALL_PATIENT') {
      targetVisitStatus = 'CALLED';
      targetQueueStatus = 'Called';
    } else if (action === 'START_CONSULTATION') {
      targetVisitStatus = 'WITH_DOCTOR';
      targetQueueStatus = 'With Doctor';
    }

    if (!allowedTransitions[visit.status]?.includes(targetVisitStatus)) {
      return res.status(409).json({ error: `Invalid visit transition from ${visit.status} to ${targetVisitStatus}` });
    }

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedVisit = await tx.visit.update({
        where: { id: visit.id },
        data: { status: targetVisitStatus }
      });

      const updatedQueue = await tx.queueEntry.update({
        where: { id: queueEntry.id },
        data: { status: targetQueueStatus }
      });

      return { queueEntry: updatedQueue, visit: updatedVisit };
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const format = req.query.format as string;
    const visitType = req.query.visitType as string;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const whereClause: any = {
      createdAt: { gte: startOfDay, lte: endOfDay }
    };

    // If logged in as Doctor, only export patients assigned to this doctor (matching Queue UI)
    if (req.user && ['Head Doctor', 'Duty Doctor'].includes(req.user.role) && req.user.staffId) {
      whereClause.assignedDoctorId = req.user.staffId;
    }

    const queue = await prisma.queueEntry.findMany({
      where: whereClause,
      orderBy: { position: 'asc' },
      include: {
        visit: {
          include: {
            patient: true,
            appointment: true
          }
        }
      }
    });

    // Check past completed visits to determine Patient Type
    const patientIds = Array.from(new Set(queue.map(q => q.patientId).filter(Boolean)));
    const pastCompletedVisits = await prisma.visit.findMany({
      where: {
        patientId: { in: patientIds },
        status: 'COMPLETED'
      },
      select: { id: true, patientId: true }
    });

    const flatData = queue.map(q => {
      const v = q.visit;
      const isAppointment = Boolean(v?.appointmentId);
      const rowVisitType = isAppointment ? 'Appointment' : 'Walk-in';

      const hasOtherCompleted = pastCompletedVisits.some(pv => pv.patientId === q.patientId && pv.id !== q.visitId);
      const patientType = hasOtherCompleted ? 'Existing Patient' : 'New Patient';

      let displayStatus = q.status;
      if (q.status === 'Waiting') displayStatus = 'Waiting';
      else if (q.status === 'In Progress' || q.status === 'With Doctor') displayStatus = 'In Progress';
      else if (q.status === 'Called') displayStatus = 'Called';
      else if (q.status === 'Completed') displayStatus = 'Completed';
      else if (q.status === 'Transferred') displayStatus = 'Transferred';

      return {
        token: `#${q.position}`,
        patientName: v?.patient?.name || 'Unknown',
        reasonForVisit: v?.reasonForVisit || 'Not Specified',
        visitType: rowVisitType,
        patientType,
        status: displayStatus
      };
    });

    let filteredData = flatData;
    if (visitType && visitType !== 'all') {
      filteredData = filteredData.filter(d => d.visitType.toLowerCase() === visitType.toLowerCase());
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(d =>
        d.patientName.toLowerCase().includes(searchLower) ||
        d.reasonForVisit.toLowerCase().includes(searchLower) ||
        d.token.toLowerCase().includes(searchLower)
      );
    }

    const columns: ExportColumn[] = [
      { key: 'token', label: 'Token' },
      { key: 'patientName', label: 'Patient Name' },
      { key: 'reasonForVisit', label: 'Reason for Visit' },
      { key: 'visitType', label: 'Visit Type' },
      { key: 'patientType', label: 'Patient Type' },
      { key: 'status', label: 'Status' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, filteredData);
      res.header('Content-Type', 'text/csv');
      res.attachment('queue_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, filteredData, 'Queue');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('queue_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const todayStr = new Date().toISOString().split('T')[0];
      const pdf = await generatePDF(columns, filteredData, 'Queue Report', `Date: ${todayStr} | Total Patients in Queue: ${filteredData.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('queue_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};

export const assignDoctor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { doctorId } = req.body;

    let doctorName = 'Unknown Doctor';
    if (doctorId === 'STF-101' || doctorId === 'STF-102') {
      doctorName = doctorId === 'STF-101' ? 'Dr. Arun' : 'Dr. Carter';
    } else {
      const doctor = await prisma.staff.findUnique({ where: { id: doctorId } });
      if (!doctor || !['Head Doctor', 'Duty Doctor'].includes(doctor.role)) {
        return res.status(400).json({ error: 'Invalid doctor selection' });
      }
      doctorName = doctor.name;
    }

    const result = await prisma.$transaction(async (tx) => {
      const queueEntry = await tx.queueEntry.findUnique({
        where: { id },
        include: { visit: true }
      });

      if (!queueEntry) {
        throw new Error('Queue entry not found');
      }

      if (queueEntry.status !== 'Waiting' && queueEntry.status !== 'In Progress' && queueEntry.status !== 'With Doctor' && queueEntry.status !== 'Called') {
        throw new Error('Patient is not eligible for assignment');
      }

      // Check if doctor is available
      const activePatient = await tx.queueEntry.findFirst({
        where: {
          assignedDoctorId: doctorId,
          status: { in: ['In Progress', 'With Doctor'] }
        }
      });

      if (activePatient) {
        throw { status: 409, message: `${doctorName} is no longer available. Please choose another available doctor.` };
      }

      // Update both Visit and QueueEntry
      await tx.visit.update({
        where: { id: queueEntry.visitId },
        data: { doctorId, status: 'WITH_DOCTOR' }
      });

      const updatedQueue = await tx.queueEntry.update({
        where: { id },
        data: {
          assignedDoctorId: doctorId,
          status: queueEntry.status === 'Waiting' ? 'In Progress' : 'Transferred'
        },
        include: { visit: true }
      });

      return updatedQueue;
    });

    return res.json({ data: { queueEntry: result, visit: result.visit } });

  } catch (error: any) {
    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Queue entry not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Patient is not waiting') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};
