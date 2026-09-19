import { z } from 'zod';

export const createPurchaseOrderItemSchema = z.object({
  medicineId: z.string().trim().min(1, 'Medicine ID is required'),
  orderedQuantity: z.number().int('Ordered quantity must be an integer').positive('Ordered quantity must be greater than 0'),
  unitCost: z.number().min(0, 'Unit cost must be greater than or equal to 0').default(0)
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z.string().trim().min(1, 'Supplier is required'),
    orderDate: z.string().optional(),
    notes: z.string().trim().optional(),
    items: z.array(createPurchaseOrderItemSchema).min(1, 'At least one medicine item is required')
  })
});

export const updatePurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z.string().trim().min(1, 'Supplier is required').optional(),
    orderDate: z.string().optional(),
    notes: z.string().trim().optional(),
    items: z.array(createPurchaseOrderItemSchema).min(1, 'At least one medicine item is required').optional()
  })
});

export const updatePurchaseOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['Draft', 'Ordered', 'Cancelled'])
  })
});

export const receivePurchaseOrderItemsSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      itemId: z.string().trim().min(1, 'Item ID is required'),
      receiveQuantity: z.number().int('Receive quantity must be an integer').positive('Receive quantity must be greater than 0')
    })).min(1, 'At least one item to receive is required'),
    bill: z.object({
      invoiceNumber: z.string().trim().min(1, 'Invoice number is required'),
      invoiceDate: z.string().optional(),
      amount: z.number().positive('Bill amount must be greater than 0'),
      billImageUrl: z.string().optional().nullable(),
      notes: z.string().trim().optional()
    }).optional()
  })
});
