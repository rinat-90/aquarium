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

export const aquariumAppearanceSchema = z.strictObject({
  background: z.enum(['ocean', 'coral', 'deep-sea', 'fantasy']),
  substrate: z.enum(['sand', 'pebbles', 'dark-gravel', 'white-sand']),
  decorations: z.array(
    z.enum(['rocks', 'driftwood', 'green-plants', 'red-coral', 'cave']),
  ).max(30),
  lighting: z.enum(['sunny', 'soft', 'night']),
  bubbles: z.enum(['none', 'some', 'lots']),
});

export const updateAquariumSchema = z.strictObject({
  name: aquariumNameSchema.optional(),
  appearance: aquariumAppearanceSchema.optional(),
}).refine(
  (value) => value.name !== undefined || value.appearance !== undefined,
  { message: 'Provide a name or appearance to update' },
);
