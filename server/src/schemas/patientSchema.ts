import { z } from 'zod';

export const createPatientSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().min(1, 'Phone is required'),
    age: z.number().int().positive('Age must be a positive number'),
    gender: z.enum(['Male', 'Female', 'Other']),
    status: z.enum(['Active', 'Inactive']).optional(),
    photoUrl: z.string().optional(),
  }),
});

export const updatePatientSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    age: z.number().int().positive().optional(),
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
    photoUrl: z.string().optional(),
  }),
});
