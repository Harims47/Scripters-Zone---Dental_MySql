import { z } from 'zod';

export const reimbursementBodySchema = z.object({
  patientId: z.string().uuid({ message: 'Valid Patient ID (UUID) is required' }),
  documentDate: z.string().min(4, { message: 'Document Date is required' }),
  subject: z.string().min(3, { message: 'Subject must be at least 3 characters' }).default('Reimbursement of Dental Treatment Expenses'),
  content: z.string().min(10, { message: 'Letter content must be at least 10 characters' }),
  treatmentDescription: z.string().optional().nullable(),
  amount: z.number().min(0, { message: 'Amount must be a non-negative number' }).optional().nullable(),
  visitId: z.string().uuid({ message: 'Visit ID must be a valid UUID' }).optional().nullable(),
  clinicName: z.string().optional(),
  clinicAddress: z.string().optional(),
  clinicPhone: z.string().optional()
});

export const createReimbursementSchema = z.object({
  body: reimbursementBodySchema
});

export const updateReimbursementBodySchema = z.object({
  documentDate: z.string().min(4, { message: 'Document Date is required' }).optional(),
  subject: z.string().min(3, { message: 'Subject must be at least 3 characters' }).optional(),
  content: z.string().min(10, { message: 'Letter content must be at least 10 characters' }).optional(),
  treatmentDescription: z.string().optional().nullable(),
  amount: z.number().min(0, { message: 'Amount must be a non-negative number' }).optional().nullable(),
  clinicName: z.string().optional(),
  clinicAddress: z.string().optional(),
  clinicPhone: z.string().optional()
});

export const updateReimbursementSchema = z.object({
  body: updateReimbursementBodySchema
});

export type CreateReimbursementInput = z.infer<typeof reimbursementBodySchema>;
export type UpdateReimbursementInput = z.infer<typeof updateReimbursementBodySchema>;

