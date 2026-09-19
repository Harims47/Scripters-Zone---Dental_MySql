import { z } from 'zod';

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Supplier name is required'),
    contactPerson: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
    address: z.string().trim().optional(),
    status: z.enum(['Active', 'Inactive']).default('Active')
  })
});

export const updateSupplierSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Supplier name is required').optional(),
    contactPerson: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
    address: z.string().trim().optional(),
    status: z.enum(['Active', 'Inactive']).optional()
  })
});
