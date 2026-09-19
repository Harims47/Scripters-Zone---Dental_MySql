import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { z } from 'zod';

export const createSupplierBillSchema = z.object({
  body: z.object({
    supplierId: z.string().trim().min(1, 'Supplier is required'),
    purchaseOrderId: z.string().trim().optional(),
    invoiceNumber: z.string().trim().min(1, 'Invoice number is required'),
    invoiceDate: z.string().optional(),
    amount: z.number().positive('Amount must be greater than 0'),
    billImageUrl: z.string().optional().nullable(),
    notes: z.string().trim().optional()
  })
});

export const recordSupplierPaymentSchema = z.object({
  body: z.object({
    amount: z.number().positive('Payment amount must be greater than 0'),
    method: z.enum(['Cash', 'Bank Transfer', 'UPI']),
    date: z.string().optional(),
    notes: z.string().trim().optional()
  })
});

export const getSupplierBills = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId, purchaseOrderId, status, search, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (supplierId && supplierId !== 'all') where.supplierId = supplierId as string;
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId as string;
    if (status && status !== 'all') where.status = status as string;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search as string } },
        { notes: { contains: search as string } },
        { supplier: { name: { contains: search as string } } }
      ];
    }

    const [bills, total] = await Promise.all([
      prisma.supplierBill.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { invoiceDate: 'desc' },
        include: {
          supplier: true,
          purchaseOrder: {
            select: { id: true, orderNumber: true, orderDate: true, status: true }
          },
          payments: {
            orderBy: { date: 'desc' }
          }
        }
      }),
      prisma.supplierBill.count({ where })
    ]);

    const formattedBills = bills.map((b) => {
      const totalPaid = b.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, Math.round((b.amount - totalPaid) * 100) / 100);
      return {
        ...b,
        totalPaid: Math.round(totalPaid * 100) / 100,
        balance
      };
    });

    return res.json({
      data: formattedBills,
      meta: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalRecords: total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSupplierBillById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const bill = await prisma.supplierBill.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseOrder: {
          include: {
            items: { include: { medicine: true } }
          }
        },
        payments: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Supplier bill not found' });
    }

    const totalPaid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, Math.round((bill.amount - totalPaid) * 100) / 100);

    return res.json({
      ...bill,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance
    });
  } catch (error) {
    next(error);
  }
};

export const createSupplierBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId, purchaseOrderId, invoiceNumber, invoiceDate, amount, billImageUrl, notes } = req.body;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    if (supplier.status !== 'Active') {
      return res.status(400).json({ error: 'Cannot create bill for Inactive supplier' });
    }

    if (purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
      if (!po) {
        return res.status(404).json({ error: 'Referenced purchase order not found' });
      }
      if (po.supplierId !== supplierId) {
        return res.status(400).json({ error: 'Purchase order does not belong to the specified supplier' });
      }
    }

    const bill = await prisma.supplierBill.create({
      data: {
        supplierId,
        purchaseOrderId: purchaseOrderId || null,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        amount: Number(amount),
        billImageUrl: billImageUrl || null,
        notes: notes ? notes.trim() : null,
        status: 'Unpaid'
      },
      include: {
        supplier: true,
        purchaseOrder: true,
        payments: true
      }
    });

    return res.status(201).json({
      message: 'Supplier bill created successfully',
      bill: {
        ...bill,
        totalPaid: 0,
        balance: bill.amount
      }
    });
  } catch (error) {
    next(error);
  }
};

export const cancelSupplierBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const bill = await prisma.supplierBill.findUnique({
      where: { id },
      include: { payments: true }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Supplier bill not found' });
    }

    if (bill.status === 'Cancelled') {
      return res.status(400).json({ error: 'Bill is already cancelled' });
    }

    if (bill.payments.length > 0) {
      return res.status(400).json({
        error: `Cannot cancel supplier bill because ${bill.payments.length} payment(s) have already been recorded against it.`
      });
    }

    const updated = await prisma.supplierBill.update({
      where: { id },
      data: { status: 'Cancelled' }
    });

    return res.json({
      message: 'Supplier bill cancelled successfully',
      bill: updated
    });
  } catch (error) {
    next(error);
  }
};

export const recordSupplierPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { amount, method, date, notes } = req.body;
    const paymentAmount = Number(amount);

    if (paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    // Atomic transaction with row locking to prevent concurrent overpayments
    const result = await prisma.$transaction(async (tx) => {
      // Raw query locking the SupplierBill row FOR UPDATE ensures strict serializability
      const lockedBills: any[] = await tx.$queryRaw`
        SELECT id, supplierId, amount, status 
        FROM \`SupplierBill\` 
        WHERE id = ${id} 
        FOR UPDATE
      `;

      if (!lockedBills || lockedBills.length === 0) {
        throw { status: 404, message: 'Supplier bill not found' };
      }

      const currentBill = lockedBills[0];

      if (currentBill.status === 'Cancelled') {
        throw { status: 400, message: 'Cannot record payment against a cancelled bill' };
      }

      // Sum existing payments atomically
      const existingPayments = await tx.supplierPayment.findMany({
        where: { supplierBillId: id }
      });

      const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
      const remainingBalance = Math.round((currentBill.amount - totalPaid) * 100) / 100;

      if (remainingBalance <= 0) {
        throw { status: 400, message: 'This bill is already fully paid. No further payments accepted.' };
      }

      if (paymentAmount > remainingBalance) {
        throw {
          status: 400,
          message: `Payment amount ₹${paymentAmount} exceeds remaining balance of ₹${remainingBalance}`
        };
      }

      // Create individual payment record
      const payment = await tx.supplierPayment.create({
        data: {
          supplierBillId: id,
          amount: paymentAmount,
          method,
          notes: notes ? notes.trim() : null,
          date: date ? new Date(date) : new Date()
        }
      });

      const newTotalPaid = Math.round((totalPaid + paymentAmount) * 100) / 100;
      const newRemaining = Math.max(0, Math.round((currentBill.amount - newTotalPaid) * 100) / 100);

      const nextStatus = newRemaining === 0 ? 'Paid' : newTotalPaid > 0 ? 'Partial' : 'Unpaid';

      const updatedBill = await tx.supplierBill.update({
        where: { id },
        data: { status: nextStatus },
        include: {
          supplier: true,
          payments: { orderBy: { date: 'desc' } }
        }
      });

      return {
        payment,
        bill: {
          ...updatedBill,
          totalPaid: newTotalPaid,
          balance: newRemaining
        }
      };
    });

    return res.status(201).json({
      success: true,
      message: 'Supplier payment recorded successfully',
      data: result
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};
