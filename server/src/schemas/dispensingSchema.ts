import { z } from 'zod';

export const dispenseItemSchema = z.object({
  medicineId: z.string().min(1, 'Invalid medicine ID'),
  prescribedQuantity: z.number().int().min(1),
  dispensedQuantity: z.number().int().min(0)
});

export const completeDispensingSchema = z.object({
  body: z.object({
    visitId: z.string().min(1, 'Invalid visit ID'),
    prescriptionId: z.string().min(1, 'Invalid prescription ID'),
    items: z.array(dispenseItemSchema).min(1, 'Must dispense at least one item')
  })
});
