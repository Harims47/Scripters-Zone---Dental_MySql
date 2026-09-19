import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import bcrypt from 'bcryptjs';

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const getStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role && role !== 'all') {
      where.role = { contains: role };
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const [staff, totalRecords] = await Promise.all([
      prisma.staff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.staff.count({ where })
    ]);

    return res.json({
      data: staff,
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

export const exportStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const role = req.query.role as string;
    const format = req.query.format as string;

    const where: any = {};
    if (role && role !== 'all') {
      where.role = { contains: role };
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const staffData = await prisma.staff.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    const exportData = staffData.map(s => ({
      name: s.name,
      role: s.role,
      phone: s.phone,
      status: s.status,
      attendance: s.attendance
    }));

    const columns: ExportColumn[] = [
      { label: 'Staff Member', key: 'name' },
      { label: 'Role', key: 'role' },
      { label: 'Phone', key: 'phone' },
      { label: 'Status', key: 'status' },
      { label: 'Attendance', key: 'attendance' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, exportData);
      res.header('Content-Type', 'text/csv');
      res.attachment('staff_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx' || format === 'excel') {
      const xlsx = await generateXLSX(columns, exportData, 'Staff');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('staff_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, exportData, 'Staff & Roles Report', `Total Staff Members: ${exportData.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('staff_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};

export const createStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, role, status, username, password, hasAccess, roomNumber, permissions } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const newStaff = await tx.staff.create({
        data: {
          name,
          phone,
          role,
          status: status || 'Active',
          attendance: 'Present',
          roomNumber,
          permissions: permissions !== undefined ? permissions : undefined
        }
      });

      if (hasAccess && username && password) {
        const passwordHash = await bcrypt.hash(password, 10);
        await tx.user.create({
          data: {
            username,
            passwordHash,
            role,
            staffId: newStaff.id
          }
        });
      }

      return newStaff;
    });

    return res.status(201).json({ data: result });
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    next(error);
  }
};

export const updateStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { name, phone, role, roomNumber, permissions } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = { name, phone, role, roomNumber };
      if (permissions !== undefined) {
        updateData.permissions = permissions;
      }

      const updatedStaff = await tx.staff.update({
        where: { id },
        data: updateData
      });

      // Update role of associated user if it exists
      const user = await tx.user.findUnique({ where: { staffId: id } });
      if (user) {
        await tx.user.update({
          where: { id: user.id },
          data: { role }
        });
      }

      return updatedStaff;
    });

    return res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const updateStaffStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const updatedStaff = await tx.staff.update({
        where: { id },
        data: { status }
      });

      if (status === 'Inactive') {
        // Revoke system access by deleting the associated user record
        await tx.user.deleteMany({ where: { staffId: id } });
      }

      return updatedStaff;
    });

    return res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const updateStaffAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { attendance } = req.body;

    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: { attendance }
    });

    return res.json({ data: updatedStaff });
  } catch (error) {
    next(error);
  }
};
