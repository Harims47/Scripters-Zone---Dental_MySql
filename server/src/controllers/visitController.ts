import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

const checkActiveVisit = async (patientId: string) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const activeVisit = await prisma.visit.findFirst({
    where: {
      patientId,
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      createdAt: { gte: startOfDay }
    }
  });
  return activeVisit !== null;
};

export const startWalkInVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, doctorId, isUrgent, reasonForVisit } = req.body;

    // Validate relationships
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(400).json({ error: 'Patient does not exist' });

    if (doctorId) {
      const doctor = await prisma.staff.findUnique({ where: { id: doctorId } });
      if (!doctor) return res.status(400).json({ error: 'Doctor does not exist' });
    }

    // Validate duplicate active visit
    const hasActive = await checkActiveVisit(patientId);
    if (hasActive) return res.status(409).json({ error: 'This patient already has an active visit.' });

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const position = await tx.queueEntry.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } }
      }) + 1;
      const arrivalTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Create Visit
      const visit = await tx.visit.create({
        data: {
          patientId,
          doctorId: doctorId || null,
          status: 'WAITING',
          amountDue: 0,
          reasonForVisit,
          queueEntry: {
            create: {
              patientId,
              assignedDoctorId: doctorId || null,
              position,
              status: 'Waiting',
              priority: isUrgent || false,
              arrivalTime
            }
          }
        },
        include: { queueEntry: true }
      });

      return visit;
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const checkInAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.body;

    // Validate appointment
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    if (['Cancelled', 'No Show'].includes(appointment.status)) {
      return res.status(409).json({ error: 'Cannot confirm arrival for a cancelled or no-show appointment.' });
    }

    if (appointment.status === 'Checked In') {
      return res.status(409).json({ error: 'Appointment is already checked in.' });
    }

    // Check duplicate visit for appointment
    const existingVisit = await prisma.visit.findUnique({ where: { appointmentId } });
    if (existingVisit) {
      return res.status(409).json({ error: 'A visit has already been created for this appointment.' });
    }

    // Check active visit for patient
    const hasActive = await checkActiveVisit(appointment.patientId);
    if (hasActive) {
      return res.status(409).json({ error: 'This patient already has an active visit.' });
    }

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const position = await tx.queueEntry.count({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } }
      }) + 1;
      const arrivalTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const reasonForVisit = req.body.reasonForVisit || appointment.type || appointment.notes || 'General Consultation';

      // Create Visit linked to Appointment
      const visit = await tx.visit.create({
        data: {
          patientId: appointment.patientId,
          doctorId: null,
          appointmentId: appointment.id,
          reasonForVisit,
          status: 'WAITING',
          amountDue: 0,
          queueEntry: {
            create: {
              patientId: appointment.patientId,
              assignedDoctorId: null,
              position,
              status: 'Waiting',
              priority: false,
              arrivalTime
            }
          }
        },
        include: { queueEntry: true }
      });

      // Update Appointment status
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'Checked In' }
      });

      return visit;
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getVisits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visits = await prisma.visit.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        queueEntry: true,
        consultation: true,
        prescription: { include: { items: true } },
        dispensing: { include: { items: true } },
        payments: true
      }
    });

    const sanitizedVisits = req.user?.role === 'Receptionist'
      ? visits.map(v => {
          if (v.paymentOwner === 'DOCTOR') {
            return {
              ...v,
              amountDue: 0,
              consultationFee: null,
              treatmentFee: null,
              medicineCost: null,
              payments: []
            };
          }
          return v;
        })
      : visits;

    return res.json(sanitizedVisits);
  } catch (error) {
    next(error);
  }
};

export const getVisitById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { 
        queueEntry: true,
        consultation: true,
        prescription: { include: { items: true } },
        dispensing: { include: { items: true } },
        payments: true
      }
    });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    if (req.user?.role === 'Receptionist' && visit.paymentOwner === 'DOCTOR') {
      visit.amountDue = 0;
      visit.consultationFee = null;
      visit.treatmentFee = null;
      visit.medicineCost = null;
      visit.payments = [];
    }

    return res.json(visit);
  } catch (error) {
    next(error);
  }
};

export const cancelVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { queueEntry: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (visit.status === 'COMPLETED' || visit.status === 'CANCELLED') {
      return res.status(400).json({ error: `Cannot cancel a visit that is already ${visit.status}` });
    }

    await prisma.$transaction(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });

      if (visit.queueEntry) {
        await tx.queueEntry.update({
          where: { visitId: id },
          data: { status: 'Cancelled' }
        });
      }
    });

    const updatedVisit = await prisma.visit.findUnique({
      where: { id },
      include: { queueEntry: true, payments: true }
    });

    return res.json(updatedVisit);
  } catch (error) {
    next(error);
  }
};

export const updateVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { reasonForVisit, doctorId, isUrgent, amountDue, paymentOwner } = req.body;

    const existingVisit = await prisma.visit.findUnique({
      where: { id },
      include: { queueEntry: true }
    });


    if (!existingVisit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (paymentOwner !== undefined && paymentOwner !== 'RECEPTION' && paymentOwner !== 'DOCTOR') {
      return res.status(400).json({ error: 'paymentOwner must be either RECEPTION or DOCTOR' });
    }

    const updatedVisit = await prisma.$transaction(async (tx) => {
      const visitData: any = {};
      if (reasonForVisit !== undefined) visitData.reasonForVisit = reasonForVisit;
      if (doctorId !== undefined) visitData.doctorId = doctorId;
      if (amountDue !== undefined) visitData.amountDue = amountDue;
      if (paymentOwner !== undefined) visitData.paymentOwner = paymentOwner;

      const v = await tx.visit.update({
        where: { id },
        data: visitData,
        include: {
          queueEntry: true,
          consultation: true,
          prescription: { include: { items: true } },
          dispensing: { include: { items: true } }
        }
      });

      if (isUrgent !== undefined && existingVisit.queueEntry) {
        await tx.queueEntry.update({
          where: { visitId: id },
          data: { priority: isUrgent }
        });
      }

      return v;
    });

    return res.json(updatedVisit);
  } catch (error) {
    next(error);
  }
};

export const transferVisits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { visitIds, targetDate, reason, isPriority } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const transferredAppointments: any[] = [];

      const targetStart = new Date(`${targetDate}T00:00:00.000Z`);
      const targetEnd = new Date(`${targetDate}T23:59:59.999Z`);
      const existingTargetCount = await tx.queueEntry.count({
        where: { createdAt: { gte: targetStart, lte: targetEnd } }
      });

      for (let i = 0; i < visitIds.length; i++) {
        const visitId = visitIds[i];
        const visit = await tx.visit.findUnique({
          where: { id: visitId },
          include: { patient: true, queueEntry: true, appointment: true }
        });

        if (!visit) continue;

        const transferReason = reason || 'Transferred from previous day queue due to clinic wait time';
        const priorityTime = `09:${String(i * 10).padStart(2, '0')}`; // Priority morning time slot
        const nextPosition = existingTargetCount + i + 1; // 1, 2, ...

        // 1. Create priority appointment for target date (unassigned doctor so reception assigns for the day)
        const newAppt = await tx.appointment.create({
          data: {
            patientId: visit.patientId,
            providerId: null,
            date: targetDate,
            time: priorityTime,
            type: visit.reasonForVisit || 'Consultation',
            status: 'Scheduled',
            notes: `[Transferred - Token #${nextPosition}] ${transferReason}`
          }
        });

        // 2. Mark current visit as CANCELLED with transfer note
        await tx.visit.update({
          where: { id: visit.id },
          data: {
            status: 'CANCELLED',
            reasonForVisit: `[Transferred to ${targetDate}] ${visit.reasonForVisit || ''}`.trim()
          }
        });

        // 3. Mark current queueEntry as Cancelled
        if (visit.queueEntry) {
          await tx.queueEntry.update({
            where: { visitId: visit.id },
            data: { status: 'Cancelled' }
          });
        }

        // 4. Pre-allot queue token for target date (Token 1, 2...) so no check-in is required
        // Doctor is left unassigned (null) so receptionist can send to duty doctor on arrival
        const targetDateTime = new Date(`${targetDate}T09:${String(i * 10).padStart(2, '0')}:00.000Z`);
        await tx.visit.create({
          data: {
            patientId: visit.patientId,
            doctorId: null,
            appointmentId: newAppt.id,
            status: 'WAITING',
            amountDue: 0,
            reasonForVisit: visit.reasonForVisit?.replace(/^\[Transferred[^\]]*\]\s*/, '') || 'Consultation',
            createdAt: targetDateTime,
            queueEntry: {
              create: {
                patientId: visit.patientId,
                assignedDoctorId: null,
                position: nextPosition,
                status: 'Waiting',
                priority: false,
                arrivalTime: priorityTime,
                createdAt: targetDateTime
              }
            }
          }
        });

        transferredAppointments.push(newAppt);
      }

      return transferredAppointments;
    });

    return res.status(200).json({
      success: true,
      message: `${result.length} patients successfully transferred to ${targetDate}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportVisits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const stage = req.query.stage as string;
    const visitType = req.query.visitType as string;
    const format = req.query.format as string;
    const date = req.query.date as string;

    const staffMembers = await prisma.staff.findMany();
    const staffMap = new Map(staffMembers.map(s => [s.id, s.name]));

    let visitWhere: any = {};
    if (date) {
      const startOfDay = new Date(new Date(`${date}T00:00:00Z`).getTime() - 14 * 3600 * 1000);
      const endOfDay = new Date(new Date(`${date}T23:59:59Z`).getTime() + 14 * 3600 * 1000);
      visitWhere = {
        OR: [
          { createdAt: { gte: startOfDay, lte: endOfDay } },
          { visitDate: { gte: startOfDay, lte: endOfDay } },
          { appointment: { date } }
        ]
      };
    }

    const rawVisits = await prisma.visit.findMany({
      where: visitWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        queueEntry: true,
        payments: true,
        appointment: true
      }
    });

    const visits = date
      ? rawVisits.filter(v => {
          const vIso = v.createdAt ? new Date(v.createdAt).toISOString().split('T')[0] : '';
          const vLocal = v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-CA') : '';
          const apptDate = v.appointment?.date;
          return vIso === date || vLocal === date || apptDate === date;
        })
      : rawVisits;

    const flatData: any[] = visits.map(v => {
      let calcStage = 'Waiting';
      const isTransferred = v.reasonForVisit?.startsWith('[Transferred') || v.queueEntry?.status === 'Transferred';
      if (isTransferred) calcStage = 'Next Day';
      else if (v.status === 'CANCELLED') calcStage = 'Cancelled';
      else if (v.status === 'COMPLETED') calcStage = 'Completed';
      else if (v.queueEntry) {
        if (v.queueEntry.status === 'Waiting') calcStage = 'Waiting';
        else if (v.queueEntry.status === 'In Progress' || v.queueEntry.status === 'With Doctor' || v.queueEntry.status === 'Called') calcStage = 'With Doctor';
        else if (v.queueEntry.status === 'Transferred') calcStage = 'Transferred';
        else if (v.queueEntry.status === 'Completed') calcStage = 'Ready at Reception';
        else calcStage = v.queueEntry.status;
      }

      const isDoctorHandled = v.paymentOwner === 'DOCTOR';
      const totalPaid = isDoctorHandled ? 0 : (v.payments || []).reduce((sum, p) => sum + p.amount, 0);
      const amountDue = isDoctorHandled ? 0 : (v.amountDue || 0);
      let paymentStatus = '—';
      if (isDoctorHandled) {
        paymentStatus = 'Handled by Doctor';
      } else if (calcStage === 'Ready at Reception' || calcStage === 'Completed') {
        paymentStatus = 'Unpaid';
        if (amountDue > 0 && totalPaid >= amountDue) paymentStatus = 'Paid';
        else if (totalPaid > 0) paymentStatus = 'Partial';
        else if (amountDue === 0) paymentStatus = 'Paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'Partial';
      }

      const type = v.appointmentId ? 'Appointment' : 'Walk-in';
      const docName = v.doctorId ? (staffMap.get(v.doctorId) || '—') : '—';

      return {
        id: v.id,
        token: v.queueEntry?.position ? `#${v.queueEntry.position}` : '—',
        patientName: v.patient?.name || 'Unknown',
        visitType: type,
        doctor: docName,
        stage: calcStage,
        paymentStatus
      };
    });

    if (date) {
      const existingApptIds = new Set(visits.map(v => v.appointmentId).filter(Boolean));
      const futureAppointments = await prisma.appointment.findMany({
        where: {
          date,
          id: { notIn: Array.from(existingApptIds) as string[] },
          status: { not: 'Cancelled' }
        }
      });

      const patientIds = futureAppointments.map(a => a.patientId);
      const apptPatients = await prisma.patient.findMany({
        where: { id: { in: patientIds } }
      });
      const patientMap = new Map(apptPatients.map(p => [p.id, p.name]));

      futureAppointments.forEach((appt, idx) => {
        const docName = appt.providerId ? (staffMap.get(appt.providerId) || '—') : '—';
        const isPriority = appt.notes?.includes('[Transferred');
        flatData.push({
          id: appt.id,
          token: `${idx + 1}`,
          patientName: patientMap.get(appt.patientId) || 'Unknown',
          visitType: 'Appointment',
          doctor: docName,
          stage: isPriority ? 'Transferred' : 'Scheduled',
          paymentStatus: '—'
        });
      });
    }

    let filteredData = flatData;
    if (stage && stage !== 'all') {
      filteredData = filteredData.filter(d => d.stage.toLowerCase() === stage.toLowerCase());
    }
    if (visitType && visitType !== 'all') {
      filteredData = filteredData.filter(d => d.visitType.toLowerCase() === visitType.toLowerCase());
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(d =>
        d.patientName.toLowerCase().includes(searchLower) ||
        d.doctor.toLowerCase().includes(searchLower) ||
        d.token.toLowerCase().includes(searchLower)
      );
    }

    const columns: ExportColumn[] = [
      { key: 'token', label: 'Token No.' },
      { key: 'patientName', label: 'Patient Name' },
      { key: 'visitType', label: 'Visit Type' },
      { key: 'doctor', label: 'Doctor Name' },
      { key: 'stage', label: 'Stage' },
      { key: 'paymentStatus', label: 'Payment Status' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, filteredData);
      res.header('Content-Type', 'text/csv');
      res.attachment('reception_desk_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, filteredData, 'Reception Desk');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('reception_desk_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const subtitle = date ? `Date: ${date} | Total Records: ${filteredData.length}` : `Total Records: ${filteredData.length}`;
      const pdf = await generatePDF(columns, filteredData, 'Reception Desk Operations Report', subtitle);
      res.header('Content-Type', 'application/pdf');
      res.attachment('reception_desk_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};


