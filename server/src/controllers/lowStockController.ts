import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

/**
 * Controller to fetch low-stock alert items.
 * Low stock condition:
 * - Medicine status is 'Active'
 * - currentStock <= stockWarningLevel
 * 
 * PO Alert Suppression condition:
 * - Medicine has an associated active PurchaseOrder with status in ['Ordered', 'Partially Received']
 * - Draft POs do NOT suppress because they have not been placed.
 * - Cancelled or Received POs do not suppress.
 */
export const getLowStockAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Find all active medicines where currentStock <= stockWarningLevel
    const candidates = await prisma.medicine.findMany({
      where: {
        status: 'Active'
      },
      select: {
        id: true,
        name: true,
        genericName: true,
        currentStock: true,
        stockWarningLevel: true,
        unit: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    const lowStockMedicines = candidates.filter(
      (med) => med.currentStock <= med.stockWarningLevel
    );

    if (lowStockMedicines.length === 0) {
      return res.json({ data: [] });
    }

    const lowStockIds = lowStockMedicines.map((m) => m.id);

    // 2. Query active PurchaseOrders in status 'Ordered' or 'Partially Received' that contain these medicines
    const qualifyingPOItems = await prisma.purchaseOrderItem.findMany({
      where: {
        medicineId: { in: lowStockIds },
        purchaseOrder: {
          status: { in: ['Ordered', 'Partially Received'] }
        }
      },
      select: {
        medicineId: true,
        purchaseOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true
          }
        }
      }
    });

    // Map medicineId -> qualifying PO summary
    const poMap = new Map<string, { poId: string; orderNumber: string; status: string }>();
    qualifyingPOItems.forEach((item) => {
      if (!poMap.has(item.medicineId)) {
        poMap.set(item.medicineId, {
          poId: item.purchaseOrder.id,
          orderNumber: item.purchaseOrder.orderNumber,
          status: item.purchaseOrder.status
        });
      }
    });

    // 3. Format response
    const results = lowStockMedicines.map((med) => {
      const activePO = poMap.get(med.id);
      return {
        id: med.id,
        name: med.name,
        genericName: med.genericName,
        currentStock: med.currentStock,
        stockWarningLevel: med.stockWarningLevel,
        unit: med.unit,
        categoryName: med.category?.name || 'General',
        hasActivePO: !!activePO,
        activePO: activePO || null
      };
    });

    return res.json({ data: results });
  } catch (error) {
    next(error);
  }
};
