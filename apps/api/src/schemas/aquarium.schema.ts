
import { z } from 'zod';

export const aquariumIdParamsSchema = z.strictObject({
  id: z.string().min(1, 'Aquarium ID is required'),
});

export const aquariumNameSchema = z
  .string()
  .trim()
  .min(1, 'Aquarium name is required')
  .max(100, 'Aquarium name must be 100 characters or less');

export const createAquariumSchema = z.strictObject({
  name: aquariumNameSchema.optional(),
});

export const updateAquariumSchema = z.strictObject({
  name: aquariumNameSchema,
});
