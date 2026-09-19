import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const getInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const category = req.query.category as string;
    const status = req.query.status as string;
    const itemType = (req.query.type as string || req.query.itemType as string || '').toLowerCase();

    const MATERIAL_FORMS = ['Material', 'Dental Material', 'Consumable', 'Instrument / Tool', 'Disposable', 'Equipment', 'Other Material'];

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { genericName: { contains: search } }
      ];
    }
    if (category && category !== 'all') {
      where.categoryId = category;
    }
    if (itemType === 'material') {
      where.form = { in: MATERIAL_FORMS };
    } else if (itemType === 'medicine') {
      where.form = { notIn: MATERIAL_FORMS };
    }

    // Since Prisma doesn't natively support comparing two columns in simple findMany,
    // we'll get all matching items first if status filter is active
    if (status && status !== 'all-status') {
      const allMatching = await prisma.medicine.findMany({
        where,
        select: { id: true, currentStock: true, stockWarningLevel: true }
      });

      let filteredIds: string[] = [];
      if (status === 'out-of-stock') {
        filteredIds = allMatching.filter(m => m.currentStock === 0).map(m => m.id);
      } else if (status === 'low-stock') {
        filteredIds = allMatching.filter(m => m.currentStock > 0 && m.currentStock < m.stockWarningLevel).map(m => m.id);
      } else if (status === 'in-stock') {
        filteredIds = allMatching.filter(m => m.currentStock >= m.stockWarningLevel).map(m => m.id);
      }

      where.id = { in: filteredIds };
    }

    const [medicines, totalRecords] = await Promise.all([
      prisma.medicine.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          category: true,
          _count: {
            select: {
              prescriptionItems: true,
              dispensingItems: true,
              purchaseOrderItems: true,
              stockMovements: true
            }
          }
        }
      }),
      prisma.medicine.count({ where })
    ]);

    // For KPI stats, calculate on everything BEFORE the ID filter, but wait, the UI stats should reflect the search & category filter, but probably NOT the status filter itself so you can see "Total In Stock" even if you filtered by "Out of Stock".
    // To do this, we'll re-fetch the stats using the base where clause without the id filter.
    const statsWhere = { ...where };
    delete statsWhere.id;

    const allStocks = await prisma.medicine.findMany({
      where: statsWhere,
      select: { currentStock: true, stockWarningLevel: true }
    });

    const totalItems = allStocks.length;
    const lowStockItems = allStocks.filter(i => i.currentStock > 0 && i.currentStock < i.stockWarningLevel).length;
    const outOfStockItems = allStocks.filter(i => i.currentStock === 0).length;
    const inStockItems = totalItems - lowStockItems - outOfStockItems;

    return res.json({
      data: medicines,
      meta: {
        currentPage: page,
        pageSize: limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        stats: {
          totalItems,
          inStockItems,
          lowStockItems,
          outOfStockItems
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: {
        category: true
      }
    });
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
    return res.json(medicine);
  } catch (error) {
    next(error);
  }
};

export const createMedicine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentStock, ...rest } = req.body;

    // Validate category exists and is Active
    if (rest.categoryId) {
      const category = await prisma.medicineCategory.findUnique({
        where: { id: rest.categoryId }
      });
      if (!category) {
        return res.status(400).json({ error: 'Selected category does not exist' });
      }
      if (category.status !== 'Active') {
        return res.status(400).json({ error: 'Cannot assign an inactive category to a new medicine' });
      }
    }

    // Current stock is ALWAYS initialized to 0 upon creation.
    // Stock must only be added via Goods Receive or an explicit Stock Adjustment with a reason.
    const medicine = await prisma.medicine.create({
      data: {
        ...rest,
        currentStock: 0
      },
      include: {
        category: true
      }
    });
    return res.status(201).json(medicine);
  } catch (error) {
    next(error);
  }
};

export const updateMedicine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    
    // verify exists
    const existing = await prisma.medicine.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Medicine not found' });

    // Explicitly reject or strip currentStock from direct updates
    const { currentStock, ...rest } = req.body;

    // If categoryId is being changed, validate it
    if (rest.categoryId && rest.categoryId !== existing.categoryId) {
      const category = await prisma.medicineCategory.findUnique({
        where: { id: rest.categoryId }
      });
      if (!category) {
        return res.status(400).json({ error: 'Selected category does not exist' });
      }
      if (category.status !== 'Active') {
        return res.status(400).json({ error: 'Cannot switch medicine to an inactive category' });
      }
    }

    const updated = await prisma.medicine.update({
      where: { id },
      data: {
        ...rest
      },
      include: {
        category: true
      }
    });
    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { quantity, type, reason } = req.body;

    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }
    if (!type || !['ADD', 'SUBTRACT'].includes(type)) {
      return res.status(400).json({ error: 'Type must be ADD or SUBTRACT' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A valid reason is required for stock adjustment' });
    }

    const performer = req.user?.username || req.user?.staff?.name || req.user?.id || 'System';

    const result = await prisma.$transaction(async (tx) => {
      // Must read current stock within transaction
      const med = await tx.medicine.findUnique({ where: { id } });
      if (!med) throw { status: 404, message: 'Medicine not found' };

      const delta = type === 'ADD' ? quantity : -quantity;
      const newStock = med.currentStock + delta;
      if (newStock < 0) {
        throw { status: 400, message: `Insufficient stock. Cannot subtract ${quantity}. Current stock is ${med.currentStock}.` };
      }

      const updatedMedicine = await tx.medicine.update({
        where: { id },
        data: { currentStock: newStock }
      });

      const movement = await tx.stockMovement.create({
        data: {
          medicineId: id,
          movementType: 'ADJUSTMENT',
          quantity: delta,
          balanceAfter: newStock,
          referenceType: 'MANUAL',
          referenceId: null,
          reason: reason.trim(),
          performedBy: performer
        }
      });

      return { medicine: updatedMedicine, movement };
    });

    return res.json(result);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

export const getMedicineStockHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const med = await prisma.medicine.findUnique({ where: { id } });
    if (!med) return res.status(404).json({ error: 'Medicine not found' });

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where: { medicineId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.stockMovement.count({ where: { medicineId: id } })
    ]);

    return res.json({
      data: movements,
      meta: {
        currentPage: page,
        pageSize: limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const category = req.query.category as string;
    const status = req.query.status as string;
    const format = req.query.format as string;
    const itemType = (req.query.type as string || req.query.itemType as string || '').toLowerCase();

    const MATERIAL_FORMS = ['Material', 'Dental Material', 'Consumable', 'Instrument / Tool', 'Disposable', 'Equipment', 'Other Material'];

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { genericName: { contains: search } }
      ];
    }
    if (category && category !== 'all') {
      where.categoryId = category;
    }
    if (itemType === 'material') {
      where.form = { in: MATERIAL_FORMS };
    } else if (itemType === 'medicine') {
      where.form = { notIn: MATERIAL_FORMS };
    }

    if (status && status !== 'all-status') {
      const allMatching = await prisma.medicine.findMany({
        where,
        select: { id: true, currentStock: true, stockWarningLevel: true }
      });

      let filteredIds: string[] = [];
      if (status === 'out-of-stock') {
        filteredIds = allMatching.filter(m => m.currentStock === 0).map(m => m.id);
      } else if (status === 'low-stock') {
        filteredIds = allMatching.filter(m => m.currentStock > 0 && m.currentStock < m.stockWarningLevel).map(m => m.id);
      } else if (status === 'in-stock') {
        filteredIds = allMatching.filter(m => m.currentStock >= m.stockWarningLevel).map(m => m.id);
      }

      where.id = { in: filteredIds };
    }

    const medicines = await prisma.medicine.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { category: true }
    });

    const flatData = medicines.map(m => {
      const isMaterial = MATERIAL_FORMS.includes(m.form);
      const typeLabel = isMaterial ? 'Material' : 'Medicine';

      let stockStatus = 'In Stock';
      if (m.status === 'Inactive') {
        stockStatus = 'Inactive';
      } else if (m.currentStock === 0) {
        stockStatus = 'Out of Stock';
      } else if (m.currentStock < m.stockWarningLevel) {
        stockStatus = 'Low Stock';
      }

      return {
        name: m.genericName ? `${m.name} (${m.genericName})` : m.name,
        type: typeLabel,
        category: m.category?.name || '—',
        unit: m.unit || '—',
        price: m.unitPrice,
        currentStock: m.currentStock,
        warningLevel: m.stockWarningLevel,
        status: stockStatus
      };
    });

    const columns: ExportColumn[] = [
      { key: 'name', label: 'Item / Material' },
      { key: 'type', label: 'Type' },
      { key: 'category', label: 'Category' },
      { key: 'unit', label: 'Unit' },
      { key: 'price', label: 'Price' },
      { key: 'currentStock', label: 'Current Stock' },
      { key: 'warningLevel', label: 'Min Level' },
      { key: 'status', label: 'Status' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, flatData);
      res.header('Content-Type', 'text/csv');
      res.attachment('inventory_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, flatData, 'Inventory');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('inventory_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, flatData, 'Inventory Report', `Total Items: ${flatData.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('inventory_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};

export const deleteMedicine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const medicine = await prisma.medicine.findUnique({ where: { id } });

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    // CASE 1: currentStock > 0 -> HTTP 400
    if (medicine.currentStock > 0) {
      return res.status(400).json({
        error: `Cannot delete a medicine with available stock (current stock: ${medicine.currentStock}). Adjust stock to 0 first.`
      });
    }

    // Inspect all historical/dependent records
    const [rxCount, dispCount, poCount, movCount] = await Promise.all([
      prisma.prescriptionItem.count({ where: { medicineId: id } }),
      prisma.dispensingItem.count({ where: { medicineId: id } }),
      prisma.purchaseOrderItem.count({ where: { medicineId: id } }),
      prisma.stockMovement.count({ where: { medicineId: id } })
    ]);

    const totalDependencies = rxCount + dispCount + poCount + movCount;

    // CASE 3: currentStock = 0 BUT historical/dependent records exist -> HTTP 409 Conflict
    if (totalDependencies > 0) {
      const details = [];
      if (rxCount > 0) details.push(`${rxCount} prescription(s)`);
      if (dispCount > 0) details.push(`${dispCount} dispensing record(s)`);
      if (poCount > 0) details.push(`${poCount} purchase order(s)`);
      if (movCount > 0) details.push(`${movCount} stock movement(s)`);

      return res.status(409).json({
        error: `Medicine cannot be permanently deleted because historical records exist (${details.join(', ')}). Deactivate it instead.`
      });
    }

    // CASE 2: currentStock = 0 AND no historical/dependent records -> Hard delete allowed
    await prisma.medicine.delete({ where: { id } });

    return res.json({
      message: `Medicine "${medicine.name}" has been permanently deleted successfully.`
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateMedicine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const medicine = await prisma.medicine.findUnique({ where: { id } });

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    if (medicine.status === 'Inactive') {
      return res.status(400).json({ error: 'Medicine is already inactive' });
    }

    const updated = await prisma.medicine.update({
      where: { id },
      data: { status: 'Inactive' }
    });

    return res.json({
      message: `Medicine "${medicine.name}" has been deactivated successfully.`,
      medicine: updated
    });
  } catch (error) {
    next(error);
  }
};

export const reactivateMedicine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: { category: true }
    });

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    if (medicine.status === 'Active') {
      return res.status(400).json({ error: 'Medicine is already active' });
    }

    // Prevent reactivating if its category is Inactive
    if (medicine.category && medicine.category.status === 'Inactive') {
      return res.status(400).json({
        error: `Cannot reactivate medicine because its category "${medicine.category.name}" is currently inactive. Please reactivate the category first.`
      });
    }

    const updated = await prisma.medicine.update({
      where: { id },
      data: { status: 'Active' }
    });

    return res.json({
      message: `Medicine "${medicine.name}" has been reactivated successfully.`,
      medicine: updated
    });
  } catch (error) {
    next(error);
  }
};

