import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Category name is required'),
    description: z.string().trim().optional().nullable()
  })
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Category name cannot be empty').optional(),
    description: z.string().trim().optional().nullable()
  })
});
