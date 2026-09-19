import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

/**
 * Helper to generate simple sequential order number: PO-YYYYMM-001
 */
async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PO-${year}${month}-`;

  const lastPO = await prisma.purchaseOrder.findFirst({
    where: {
      orderNumber: { startsWith: prefix }
    },
    orderBy: { orderNumber: 'desc' }
  });

  let nextSeq = 1;
  if (lastPO && lastPO.orderNumber) {
    const parts = lastPO.orderNumber.split('-');
    const seqStr = parts[parts.length - 1];
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

export const getPurchaseOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const supplierId = req.query.supplierId as string;
    const search = req.query.search as string;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (supplierId && supplierId !== 'all') {
      where.supplierId = supplierId;
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { notes: { contains: search } },
        { supplier: { name: { contains: search } } }
      ];
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        items: {
          include: { medicine: true }
        },
        bills: {
          include: { payments: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return res.json(orders);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: { medicine: true }
        },
        bills: {
          include: { payments: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    return res.json(order);
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId, orderDate, notes, items } = req.body;

    // 1. Validate Supplier
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    if (supplier.status !== 'Active') {
      return res.status(400).json({ error: 'Cannot create purchase order for Inactive supplier' });
    }

    // 2. Validate all medicines exist and are Active
    const medicineIds = items.map((i: any) => i.medicineId);
    const foundMedicines = await prisma.medicine.findMany({
      where: { id: { in: medicineIds } }
    });
    if (foundMedicines.length !== medicineIds.length) {
      return res.status(400).json({ error: 'One or more specified medicines do not exist' });
    }
    const inactiveMedicine = foundMedicines.find(m => m.status === 'Inactive');
    if (inactiveMedicine) {
      return res.status(400).json({ error: `Cannot order inactive medicine "${inactiveMedicine.name}". Please activate it first or select an active medicine.` });
    }

    // 3. Create PO inside transaction to guarantee unique orderNumber and line items
    // Stock is INVARIANT here: Medicine.currentStock is NEVER modified.
    const result = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber();

      const po = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          status: 'Draft',
          notes: notes?.trim() || null,
          items: {
            create: items.map((i: any) => ({
              medicineId: i.medicineId,
              orderedQuantity: i.orderedQuantity,
              receivedQuantity: 0,
              unitCost: i.unitCost || 0
            }))
          }
        },
        include: {
          supplier: true,
          items: {
            include: { medicine: true }
          }
        }
      });

      return po;
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { supplierId, orderDate, notes, items } = req.body;

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existingPO) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Invariant: Only Draft POs may be edited
    if (existingPO.status !== 'Draft') {
      return res.status(400).json({ error: `Cannot edit purchase order in status ${existingPO.status}. Only Draft POs can be edited.` });
    }

    if (supplierId) {
      const sup = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!sup) return res.status(404).json({ error: 'Supplier not found' });
      if (sup.status !== 'Active') return res.status(400).json({ error: 'Cannot assign Inactive supplier' });
    }

    if (items) {
      const medicineIds = items.map((i: any) => i.medicineId);
      const foundMedicines = await prisma.medicine.findMany({
        where: { id: { in: medicineIds } }
      });
      if (foundMedicines.length !== medicineIds.length) {
        return res.status(400).json({ error: 'One or more specified medicines do not exist' });
      }
      const inactiveMedicine = foundMedicines.find(m => m.status === 'Inactive');
      if (inactiveMedicine) {
        return res.status(400).json({ error: `Cannot order inactive medicine "${inactiveMedicine.name}". Please activate it first or select an active medicine.` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        // Replace items
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.createMany({
          data: items.map((i: any) => ({
            purchaseOrderId: id,
            medicineId: i.medicineId,
            orderedQuantity: i.orderedQuantity,
            receivedQuantity: 0,
            unitCost: i.unitCost || 0
          }))
        });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(supplierId && { supplierId }),
          ...(orderDate && { orderDate: new Date(orderDate) }),
          ...(notes !== undefined && { notes: notes ? notes.trim() : null })
        },
        include: {
          supplier: true,
          items: {
            include: { medicine: true }
          }
        }
      });
    });

    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status: targetStatus } = req.body;

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const currentStatus = po.status;

    // Disallow setting 'Received' or 'Partially Received' via manual status update API
    // Received status MUST be earned through actual Goods Receiving.
    if (targetStatus === 'Received' || targetStatus === 'Partially Received') {
      return res.status(400).json({
        error: `Cannot manually set status to ${targetStatus}. Status is automatically updated via Goods Receiving.`
      });
    }

    // Allowed manual transitions:
    // Draft -> Ordered
    // Draft -> Cancelled
    // Ordered -> Cancelled
    const allowedTransitions: Record<string, string[]> = {
      'Draft': ['Ordered', 'Cancelled'],
      'Ordered': ['Cancelled']
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from ${currentStatus} to ${targetStatus}. Allowed transitions from ${currentStatus}: ${allowed.join(', ') || 'None'}.`
      });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: targetStatus },
      include: {
        supplier: true,
        items: {
          include: { medicine: true }
        }
      }
    });

    // When PO is sent to supplier (Ordered), queue Purchase Order email notification
    if (targetStatus === 'Ordered' && updated.supplier?.email) {
      const { NotificationService } = await import('../services/communication/NotificationService');
      const totalAmount = updated.items.reduce((sum: number, item: any) => sum + (item.orderedQuantity * item.unitCost), 0);
      NotificationService.requestNotification({
        type: 'PURCHASE_ORDER_SENT',
        entityType: 'PURCHASE_ORDER',
        entityId: updated.id,
        recipientEmail: updated.supplier.email,
        recipientName: updated.supplier.name,
        variables: {
          orderNumber: updated.orderNumber,
          supplierName: updated.supplier.name,
          totalAmount,
        },
      }, { userId: req.user?.id, role: req.user?.role })
      .catch((err: any) => console.error('[Notification] Failed to queue purchase order email:', err.message));
    }

    return res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const receivePurchaseOrderItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { items: receiveRequests } = req.body as { items: { itemId: string, receiveQuantity: number }[] };

    const performer = req.user?.username || req.user?.staff?.name || req.user?.id || 'Staff';

    // Atomic transaction for receiving goods
    const result = await prisma.$transaction(async (tx) => {
      // 1. Re-read PO and its line items inside transaction
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          items: {
            include: { medicine: true }
          }
        }
      });

      if (!po) {
        throw { status: 404, message: 'Purchase order not found' };
      }

      // Invariant: Can only receive against 'Ordered' or 'Partially Received' POs
      if (po.status !== 'Ordered' && po.status !== 'Partially Received') {
        throw {
          status: 400,
          message: `Cannot receive items for purchase order in status '${po.status}'. Goods can only be received when status is 'Ordered' or 'Partially Received'.`
        };
      }

      const itemMap = new Map(po.items.map(item => [item.id, item]));

      // 2. Validate all items before making any modifications
      for (const reqItem of receiveRequests) {
        const poItem = itemMap.get(reqItem.itemId);
        if (!poItem) {
          throw {
            status: 400,
            message: `Item ${reqItem.itemId} is not part of purchase order ${po.orderNumber}.`
          };
        }

        if (!Number.isInteger(reqItem.receiveQuantity) || reqItem.receiveQuantity <= 0) {
          throw {
            status: 400,
            message: `Receive quantity for ${poItem.medicine.name} must be a positive integer.`
          };
        }

        const remaining = poItem.orderedQuantity - poItem.receivedQuantity;
        if (reqItem.receiveQuantity > remaining) {
          throw {
            status: 400,
            message: `Cannot receive ${reqItem.receiveQuantity} for ${poItem.medicine.name}. Remaining unreceived quantity is only ${remaining} (Ordered: ${poItem.orderedQuantity}, Already Received: ${poItem.receivedQuantity}).`
          };
        }
      }

      // 3. Process each receive item:
      // - Increment PurchaseOrderItem.receivedQuantity
      // - Increment Medicine.currentStock
      // - Create StockMovement record
      const movementsCreated = [];

      for (const reqItem of receiveRequests) {
        const poItem = itemMap.get(reqItem.itemId)!;
        const newReceivedQty = poItem.receivedQuantity + reqItem.receiveQuantity;

        // Update line item
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQuantity: newReceivedQty }
        });

        // Re-read current medicine stock atomically
        const med = await tx.medicine.findUnique({ where: { id: poItem.medicineId } });
        if (!med) {
          throw { status: 404, message: `Medicine ${poItem.medicineId} not found` };
        }

        const newStock = med.currentStock + reqItem.receiveQuantity;

        // Atomically increase stock
        await tx.medicine.update({
          where: { id: med.id },
          data: { currentStock: newStock }
        });

        // Create append-only StockMovement audit log
        const movement = await tx.stockMovement.create({
          data: {
            medicineId: med.id,
            movementType: 'PURCHASE_RECEIPT',
            quantity: reqItem.receiveQuantity,
            balanceAfter: newStock,
            referenceType: 'PURCHASE_ORDER',
            referenceId: po.id,
            reason: `Goods received against ${po.orderNumber}`,
            performedBy: performer
          }
        });

        movementsCreated.push(movement);
        // Update local map copy to reflect new quantity in status check below
        poItem.receivedQuantity = newReceivedQty;
      }

      // 4. Recalculate PO Status based on updated received quantities
      const allItems = Array.from(itemMap.values());
      const allFullyReceived = allItems.every(i => i.receivedQuantity >= i.orderedQuantity);
      const anyReceived = allItems.some(i => i.receivedQuantity > 0);

      const nextStatus = allFullyReceived ? 'Received' : anyReceived ? 'Partially Received' : po.status;

      const updatedPO = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: nextStatus },
        include: {
          supplier: true,
          items: {
            include: { medicine: true }
          },
          bills: true
        }
      });

      // 5. Optional Supplier Bill creation (atomic with goods receiving)
      let createdBill = null;
      if (req.body.bill) {
        const { invoiceNumber, invoiceDate, amount, billImageUrl, notes } = req.body.bill;
        createdBill = await tx.supplierBill.create({
          data: {
            supplierId: po.supplierId,
            purchaseOrderId: po.id,
            invoiceNumber: invoiceNumber.trim(),
            invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            amount: Number(amount),
            billImageUrl: billImageUrl || null,
            notes: notes ? notes.trim() : null,
            status: 'Unpaid'
          }
        });
      }

      return {
        purchaseOrder: updatedPO,
        movements: movementsCreated,
        bill: createdBill
      };
    });

    return res.json({
      success: true,
      message: 'Goods received successfully',
      data: result
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

import { generateCSV, generateXLSX, generatePDF, ExportColumn } from '../services/exportService';

export const exportPurchaseOrders = async (req: Request, res: Response, next: NextFunction) => {
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
        { orderNumber: { contains: search } },
        { notes: { contains: search } },
        { supplier: { name: { contains: search } } }
      ];
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        items: true
      }
    });

    const exportData = orders.map((po) => ({
      orderNumber: po.orderNumber,
      supplierName: po.supplier?.name || '—',
      orderDate: new Date(po.orderDate).toISOString().split('T')[0],
      itemsCount: po.items?.length || 0,
      status: po.status,
      notes: po.notes || ''
    }));

    const columns: ExportColumn[] = [
      { key: 'orderNumber', label: 'PO Number' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'orderDate', label: 'Order Date' },
      { key: 'itemsCount', label: 'Items Count' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' }
    ];

    if (format === 'csv') {
      const csv = generateCSV(columns, exportData);
      res.header('Content-Type', 'text/csv');
      res.attachment('purchase_orders_export.csv');
      return res.send(csv);
    } else if (format === 'xlsx') {
      const xlsx = await generateXLSX(columns, exportData, 'PurchaseOrders');
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('purchase_orders_export.xlsx');
      return res.send(xlsx);
    } else if (format === 'pdf') {
      const pdf = await generatePDF(columns, exportData, 'Purchase Orders Summary', `Total Orders: ${orders.length}`);
      res.header('Content-Type', 'application/pdf');
      res.attachment('purchase_orders_export.pdf');
      return res.send(pdf);
    } else {
      return res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    next(error);
  }
};

