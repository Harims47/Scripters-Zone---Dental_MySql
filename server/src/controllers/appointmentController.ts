import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const date = req.query.date as string;
    const doctor = req.query.doctor as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { patientId: { contains: search } },
        { providerId: { contains: search } },
        { notes: { contains: search } }
      ];
    }
    if (status && status !== 'all-status') {
      where.status = { equals: status };
    }
    if (doctor && doctor !== 'all-doctors') {
      where.providerId = doctor;
    }
    if (date && date !== 'all-dates') {
      const today = new Date();
      const format = (d: Date) => d.toISOString().split('T')[0];
      
      if (date === 'today') {
        where.date = format(today);
      } else if (date === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        where.date = format(tomorrow);
      } else if (date === 'next-7-days') {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        where.date = { gte: format(today), lte: format(nextWeek) };
      }
    }

    const [appointments, totalRecords] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,

        orderBy: [
          { date: 'asc' },
          { time: 'asc' }
        ]
      }),
      prisma.appointment.count({ where })
    ]);

    return res.json({
      data: appointments,
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

export const getAppointmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const appointment = await prisma.appointment.findUnique({
      where: { id }
    });
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    return res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    
    // Validate Patient exists
    const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) {
      return res.status(400).json({ error: 'Invalid patient ID: Patient does not exist' });
    }

    // Validate Provider exists
    if (data.providerId) {
      const provider = await prisma.staff.findUnique({ where: { id: data.providerId } });
      if (!provider || !provider.role.includes('Doctor')) {
        return res.status(400).json({ error: 'Provider must be a Doctor' });
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: data.patientId,
        providerId: data.providerId,
        date: data.date,
        time: data.time,
        type: data.type,
        status: data.status || 'Scheduled',
        notes: data.notes,
        photoUrl: data.photoUrl
      }
    });

    // Asynchronously queue appointment confirmation notification
    const { NotificationService } = await import('../services/communication/NotificationService');
    NotificationService.requestNotification({
      type: 'APPOINTMENT_CONFIRMATION',
      patientId: patient.id,
      entityType: 'APPOINTMENT',
      entityId: appointment.id,
      recipientPhone: patient.phone || undefined,
      recipientEmail: patient.email || undefined,
      recipientName: patient.name,
      variables: {
        date: appointment.date,
        time: appointment.time,
        type: appointment.type,
      },
    }).catch((err) => console.error('[Notification] Failed to queue appointment confirmation:', err.message));

    return res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};

export const updateAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = req.body;
    
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Creating an appointment does NOT create a visit automatically.
    // The instructions say "Do not prematurely implement Visit/Queue creation".

    const allowedUpdateData: Record<string, any> = {};
    if (data.patientId !== undefined) allowedUpdateData.patientId = data.patientId;
    if (data.providerId !== undefined) allowedUpdateData.providerId = data.providerId;
    if (data.date !== undefined) allowedUpdateData.date = data.date;
    if (data.time !== undefined) allowedUpdateData.time = data.time;
    if (data.type !== undefined) allowedUpdateData.type = data.type;
    if (data.status !== undefined) allowedUpdateData.status = data.status;
    if (data.notes !== undefined) allowedUpdateData.notes = data.notes;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: allowedUpdateData
    });
    return res.json(appointment);
  } catch (error) {
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const status = req.query.status as string;
    const date = req.query.date as string;
    const doctor = req.query.doctor as string;
    const format = req.query.format as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { patientId: { contains: search } },
        { providerId: { contains: search } },
        { notes: { contains: search } }
      ];
    }
    if (status && status !== 'all-status') {
      where.status = { equals: status };
    }
    if (doctor && doctor !== 'all-doctors') {
      where.providerId = doctor;
    }
    if (date && date !== 'all-dates') {
      const today = new Date();
      const formatStr = (d: Date) => d.toISOString().split('T')[0];
      
      if (date === 'today') {
        where.date = formatStr(today);
      } else if (date === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        where.date = formatStr(tomorrow);
      } else if (date === 'next-7-days') {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        where.date = { gte: formatStr(today), lte: formatStr(nextWeek) };
      }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { time: 'asc' }
      ]
    });

    const columns: ExportColumn[] = [
      { key: 'id', label: 'Appointment ID' },
      { key: 'patientId', label: 'Patient ID' },
      { key: 'providerId', label: 'Provider ID' },
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, appointments);
      res.header('Content-Type', 'text/csv');
      res.attachment('appointments_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, appointments, 'Appointments');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('appointments_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, appointments, 'Appointments Report', `Total Records: ${appointments.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('appointments_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};
