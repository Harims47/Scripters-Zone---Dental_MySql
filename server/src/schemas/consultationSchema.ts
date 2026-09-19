import { z } from 'zod';

export const createConsultationSchema = z.object({
  body: z.object({
    visitId: z.string().min(1, 'Invalid visit ID'),
    reasonForVisit: z.string().min(1, 'Reason for visit is required'),
    clinicalNotes: z.string().min(1, 'Clinical notes are required'),
    consultationFee: z.number().min(0, 'Fee cannot be negative').optional()
  })
});

export const updateConsultationSchema = z.object({
  body: z.object({
    reasonForVisit: z.string().min(1).optional(),
    clinicalNotes: z.string().min(1).optional(),
    consultationFee: z.number().min(0).optional()
  })
});

export const completeConsultationSchema = z.object({
  body: z.object({
    paymentOwner: z.enum(['RECEPTION', 'DOCTOR']).optional().default('RECEPTION')
  })
});
