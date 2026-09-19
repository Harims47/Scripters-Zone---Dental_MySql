import { z } from 'zod';

export const createPaymentSchema = z.object({
  body: z.object({
    visitId: z.string().min(1, 'Invalid visit ID'),
    amount: z.number().positive('Amount must be positive'),
    method: z.enum(['Cash', 'GPay', 'Credit Card', 'Debit Card']),
    notes: z.string().optional()
  })
});
