
import { z } from 'zod';

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color');

const speciesSchema = z.enum([
  'classic',
  'angelfish',
  'drawn',
]);

const sizeSchema = z.number().min(0.1).max(5);

export const fishIdParamsSchema = z.strictObject({
  id: z.string().min(1, 'Fish ID is required'),
});

export const createFishSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  species: speciesSchema.optional(),
  bodyColor: colorSchema.optional(),
  finColor: colorSchema.optional(),
  size: sizeSchema.optional(),
  aquariumId: z.string().min(1).optional(),
});

export const updateFishSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    species: speciesSchema.optional(),
    bodyColor: colorSchema.optional(),
    finColor: colorSchema.optional(),
    size: sizeSchema.optional(),
    aquariumId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field is required',
  );
