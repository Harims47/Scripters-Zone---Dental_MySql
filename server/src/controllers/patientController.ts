import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getPatients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const gender = req.query.gender as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (gender && gender !== 'all') {
      where.gender = gender;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { id: { contains: search } }
      ];
    }

    const [patients, totalRecords] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.patient.count({ where })
    ]);

    return res.json({
      data: patients,
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

export const getPatientById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const patient = await prisma.patient.findUnique({
      where: { id }
    });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    return res.json(patient);
  } catch (error) {
    next(error);
  }
};

export const createPatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const patient = await prisma.patient.create({
      data: {
        name: data.name,
        phone: data.phone,
        age: data.age,
        gender: data.gender,
        status: data.status || 'Active',
        photoUrl: data.photoUrl,
        address: data.address,
        email: data.email || null,
        preferredCommunicationChannel: data.preferredCommunicationChannel || 'AUTO'
      }
    });
    return res.status(201).json(patient);
  } catch (error) {
    next(error);
  }
};

export const updatePatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = req.body;
    
    // Check if patient exists
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = await prisma.patient.update({
      where: { id },
      data
    });
    return res.json(patient);
  } catch (error) {
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportPatients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const gender = req.query.gender as string;
    const format = req.query.format as string;

    const where: any = {};
    if (gender && gender !== 'all') {
      where.gender = gender;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { id: { contains: search } }
      ];
    }

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const columns: ExportColumn[] = [
      { key: 'id', label: 'Patient ID' },
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'age', label: 'Age' },
      { key: 'gender', label: 'Gender' },
      { key: 'status', label: 'Status' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, patients);
      res.header('Content-Type', 'text/csv');
      res.attachment('patients_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, patients, 'Patients');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('patients_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, patients, 'Patients Report', `Total Records: ${patients.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('patients_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};
