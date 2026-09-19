import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const search = req.query.search as string;
    const categoryId = req.query.categoryId as string;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (categoryId && categoryId !== 'all') {
      where.categories = {
        some: { medicineCategoryId: categoryId }
      };
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactPerson: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } }
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchaseOrders: true, bills: true, categories: true }
        },
        categories: {
          include: {
            medicineCategory: true
          }
        },
        bills: {
          where: { status: { not: 'Cancelled' } },
          select: {
            amount: true,
            payments: {
              select: { amount: true }
            }
          }
        }
      }
    });

    const formatted = suppliers.map(s => {
      const totalBilled = s.bills.reduce((sum, b) => sum + b.amount, 0);
      const totalPaid = s.bills.reduce((sum, b) => sum + b.payments.reduce((pSum, p) => pSum + p.amount, 0), 0);
      const outstandingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

      const { bills, categories, ...rest } = s;
      return {
        ...rest,
        categories: categories.map(c => c.medicineCategory),
        financials: {
          totalBills: s._count.bills,
          totalBilled: Math.round(totalBilled * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          outstandingBalance
        }
      };
    });

    return res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            medicineCategory: true
          }
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const { categories, ...rest } = supplier;
    return res.json({
      ...rest,
      categories: categories.map(c => c.medicineCategory)
    });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, contactPerson, phone, email, address, status, medicineCategoryIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    // Validate medicineCategoryIds if provided
    let validCategoryIds: string[] = [];
    if (Array.isArray(medicineCategoryIds) && medicineCategoryIds.length > 0) {
      const uniqueIds = Array.from(new Set(medicineCategoryIds.filter(Boolean)));
      // Verify categories exist and are Active
      const foundCategories = await prisma.medicineCategory.findMany({
        where: {
          id: { in: uniqueIds as string[] }
        }
      });

      if (foundCategories.length !== uniqueIds.length) {
        return res.status(400).json({ error: 'One or more selected medicine categories do not exist' });
      }

      // Check if any category is inactive
      const inactive = foundCategories.find(c => c.status !== 'Active');
      if (inactive) {
        return res.status(400).json({ error: `Cannot associate inactive category "${inactive.name}"` });
      }

      validCategoryIds = foundCategories.map(c => c.id);
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name: name.trim(),
          contactPerson: contactPerson ? contactPerson.trim() : null,
          phone: phone ? phone.trim() : null,
          email: email ? email.trim() : null,
          address: address ? address.trim() : null,
          status: status || 'Active',
          ...(validCategoryIds.length > 0 && {
            categories: {
              create: validCategoryIds.map(catId => ({
                medicineCategoryId: catId
              }))
            }
          })
        },
        include: {
          categories: {
            include: { medicineCategory: true }
          }
        }
      });
      return created;
    });

    const { categories, ...rest } = supplier;
    return res.status(201).json({
      ...rest,
      categories: categories.map(c => c.medicineCategory)
    });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { categories: true }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const { name, contactPerson, phone, email, address, status, medicineCategoryIds } = req.body;

    // Validate medicineCategoryIds if provided
    let updateCategories = false;
    let targetCategoryIds: string[] = [];

    if (medicineCategoryIds !== undefined) {
      updateCategories = true;
      if (Array.isArray(medicineCategoryIds) && medicineCategoryIds.length > 0) {
        const uniqueIds = Array.from(new Set(medicineCategoryIds.filter(Boolean))) as string[];
        const foundCategories = await prisma.medicineCategory.findMany({
          where: {
            id: { in: uniqueIds }
          }
        });

        if (foundCategories.length !== uniqueIds.length) {
          return res.status(400).json({ error: 'One or more selected medicine categories do not exist' });
        }

        // Newly added categories must be Active (allow existing associations even if category became inactive)
        const existingCatIds = new Set(existing.categories.map(c => c.medicineCategoryId));
        for (const cat of foundCategories) {
          if (cat.status !== 'Active' && !existingCatIds.has(cat.id)) {
            return res.status(400).json({ error: `Cannot associate inactive category "${cat.name}"` });
          }
        }

        targetCategoryIds = foundCategories.map(c => c.id);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (updateCategories) {
        // Delete categories not in target
        await tx.supplierMedicineCategory.deleteMany({
          where: {
            supplierId: id,
            medicineCategoryId: { notIn: targetCategoryIds }
          }
        });

        // Add categories in target not already in existing
        const existingCatIds = new Set(existing.categories.map(c => c.medicineCategoryId));
        const newIdsToAdd = targetCategoryIds.filter(cid => !existingCatIds.has(cid));

        if (newIdsToAdd.length > 0) {
          await tx.supplierMedicineCategory.createMany({
            data: newIdsToAdd.map(cid => ({
              supplierId: id,
              medicineCategoryId: cid
            }))
          });
        }
      }

      const resSup = await tx.supplier.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(contactPerson !== undefined && { contactPerson: contactPerson ? contactPerson.trim() : null }),
          ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
          ...(email !== undefined && { email: email ? email.trim() : null }),
          ...(address !== undefined && { address: address ? address.trim() : null }),
          ...(status !== undefined && { status })
        },
        include: {
          categories: {
            include: { medicineCategory: true }
          }
        }
      });

      return resSup;
    });

    const { categories, ...rest } = updated;
    return res.json({
      ...rest,
      categories: categories.map(c => c.medicineCategory)
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: { select: { purchaseOrders: true } }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Always prefer setting status to Inactive to preserve historical Purchase Orders
    const updated = await prisma.supplier.update({
      where: { id },
      data: { status: 'Inactive' }
    });

    return res.json({ message: 'Supplier marked as Inactive', supplier: updated });
  } catch (error) {
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const status = req.query.status as string;
    const categoryId = req.query.categoryId as string;
    const format = req.query.format as string;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (categoryId && categoryId !== 'all') {
      where.categories = {
        some: { medicineCategoryId: categoryId }
      };
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactPerson: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } }
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        categories: {
          include: { medicineCategory: true }
        }
      }
    });

    const rows = suppliers.map(s => ({
      name: s.name,
      contactPerson: s.contactPerson || '—',
      phone: s.phone || '—',
      email: s.email || '—',
      categories: s.categories.map(c => c.medicineCategory.name).join(', ') || 'None',
      address: s.address || '—',
      status: s.status
    }));

    const columns: ExportColumn[] = [
      { key: 'name', label: 'Supplier Name' },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'categories', label: 'Categories Supplied' },
      { key: 'address', label: 'Address' },
      { key: 'status', label: 'Status' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('suppliers_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, rows, 'Suppliers');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('suppliers_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, rows, 'Suppliers Directory', `Total Suppliers: ${suppliers.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('suppliers_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};

