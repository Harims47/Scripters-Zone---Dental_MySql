import { z } from 'zod';

export const adjustStockSchema = z.object({
  body: z.object({
    quantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than 0'),
    type: z.enum(['ADD', 'SUBTRACT']),
    reason: z.string().trim().min(1, 'Reason is required')
  })
});

export const createMedicineSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    genericName: z.string().trim().optional(),
    categoryId: z.string().trim().min(1, 'Category is required'),
    unit: z.string().trim().min(1, 'Unit is required'),
    stockWarningLevel: z.number().min(0, 'Minimum stock must be 0 or positive').default(10),
    unitPrice: z.number().min(0, 'Unit price must be 0 or positive').default(0),
    form: z.string().default('Tablet'),
    // Reject direct mutation of currentStock if supplied with non-zero value
    currentStock: z.number().optional()
  })
});

export const updateMedicineSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').optional(),
    genericName: z.string().trim().optional(),
    categoryId: z.string().trim().min(1, 'Category is required').optional(),
    unit: z.string().trim().min(1, 'Unit is required').optional(),
    stockWarningLevel: z.number().min(0, 'Minimum stock must be 0 or positive').optional(),
    unitPrice: z.number().min(0, 'Unit price must be 0 or positive').optional(),
    form: z.string().optional(),
    currentStock: z.number().optional()
  })
});

