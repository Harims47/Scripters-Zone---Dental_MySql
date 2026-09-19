import { z } from 'zod';

export const transitionQueueSchema = z.object({
  body: z.object({
    action: z.enum(['CALL_PATIENT', 'START_CONSULTATION'])
  })
});

export const assignDoctorSchema = z.object({
  body: z.object({
    doctorId: z.string().min(1)
  })
});
