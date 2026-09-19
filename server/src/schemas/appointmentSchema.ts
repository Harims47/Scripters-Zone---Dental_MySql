import { z } from 'zod';

export const createAppointmentSchema = z.object({
  body: z.object({
    patientId: z.string().min(1, 'Invalid patient ID'),
    providerId: z.string().optional(),
    date: z.string().min(1, 'Date is required'),
    time: z.string().min(1, 'Time is required'),
    type: z.enum(['Consultation', 'Surgery', 'Follow-up', 'Routine Checkup', 'Emergency', 'Cleaning', 'Toothache']),
    status: z.enum(['Scheduled', 'Confirmed', 'Checked In', 'Completed', 'Cancelled', 'No Show']).optional(),
    notes: z.string().optional(),
    photoUrl: z.string().optional(),
  }),
});

export const updateAppointmentSchema = z.object({
  body: z.object({
    date: z.string().min(1).optional(),
    time: z.string().min(1).optional(),
    type: z.enum(['Consultation', 'Surgery', 'Follow-up', 'Routine Checkup', 'Emergency']).optional(),
    status: z.enum(['Scheduled', 'Confirmed', 'Checked In', 'Completed', 'Cancelled', 'No Show']).optional(),
    notes: z.string().optional(),
    photoUrl: z.string().optional(),
  }),
});
