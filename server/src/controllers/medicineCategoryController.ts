import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const getMedicineCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 0;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }

    // If pagination params are supplied, return standard paginated payload
    if (page > 0 && limit > 0) {
      const skip = (page - 1) * limit;
      const [categories, totalRecords] = await Promise.all([
        prisma.medicineCategory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { medicines: true }
            }
          }
        }),
        prisma.medicineCategory.count({ where })
      ]);

      return res.json({
        data: categories,
        meta: {
          currentPage: page,
          pageSize: limit,
          totalRecords,
          totalPages: Math.ceil(totalRecords / limit)
        }
      });
    }

    // Default: return all matching categories
    const categories = await prisma.medicineCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    return res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const getMedicineCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const category = await prisma.medicineCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    return res.json(category);
  } catch (error) {
    next(error);
  }
};

export const createMedicineCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = (req.body.name || '').trim();
    const description = req.body.description ? req.body.description.trim() : null;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Case-insensitive duplicate check
    const existing = await prisma.medicineCategory.findFirst({
      where: {
        name: { equals: name }
      }
    });

    if (existing) {
      return res.status(400).json({ error: `Category "${name}" already exists` });
    }

    const category = await prisma.medicineCategory.create({
      data: {
        name,
        description,
        status: 'Active'
      },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    return res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const updateMedicineCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.medicineCategory.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : undefined;
    const description = req.body.description !== undefined ? (req.body.description ? req.body.description.trim() : null) : undefined;

    if (name !== undefined) {
      if (!name) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }

      // Check unique name conflicts with other categories
      const duplicate = await prisma.medicineCategory.findFirst({
        where: {
          name: { equals: name },
          id: { not: id }
        }
      });

      if (duplicate) {
        return res.status(400).json({ error: `Category "${name}" already exists` });
      }
    }

    const updated = await prisma.medicineCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description })
      },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const deactivateMedicineCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.medicineCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updated = await prisma.medicineCategory.update({
      where: { id },
      data: { status: 'Inactive' },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    return res.json({
      message: `Category "${existing.name}" deactivated successfully`,
      category: updated,
      affectedMedicineCount: existing._count.medicines
    });
  } catch (error) {
    next(error);
  }
};

export const reactivateMedicineCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.medicineCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updated = await prisma.medicineCategory.update({
      where: { id },
      data: { status: 'Active' },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    return res.json({
      message: `Category "${existing.name}" reactivated successfully`,
      category: updated
    });
  } catch (error) {
    next(error);
  }
};

export const exportMedicineCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const status = req.query.status as string;
    const format = req.query.format as string;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const categories = await prisma.medicineCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { medicines: true }
        }
      }
    });

    const exportData = categories.map(cat => ({
      name: cat.name,
      description: cat.description || '—',
      medicineCount: cat._count.medicines,
      status: cat.status,
      createdAt: cat.createdAt.toISOString().split('T')[0]
    }));

    const columns: ExportColumn[] = [
      { key: 'name', label: 'Category Name' },
      { key: 'description', label: 'Description' },
      { key: 'medicineCount', label: 'Medicines' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Created At' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, exportData);
      res.header('Content-Type', 'text/csv');
      res.attachment('medicine_categories_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, exportData, 'Medicine Categories');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('medicine_categories_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, exportData, 'Medicine Categories Directory', `Total Categories: ${categories.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('medicine_categories_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};
