import { z } from 'zod';

export const prescriptionItemSchema = z.object({
  medicineId: z.string().min(1, 'Invalid medicine ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  dosage: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  instructions: z.string()
});

export const upsertPrescriptionSchema = z.object({
  body: z.object({
    visitId: z.string().min(1, 'Invalid visit ID'),
    notes: z.string().optional(),
    items: z.array(prescriptionItemSchema)
  })
});
