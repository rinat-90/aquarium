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

export const aquariumDecorationInstanceSchema = z.strictObject({
  id: z.string().min(1).max(100),
  assetId: z.enum(['rocks', 'seaweed', 'coral']),
  x: z.number().finite().min(0).max(1),
  depth: z.number().finite().min(0).max(1),
  scale: z.number().finite().min(0.3).max(2),
  rotation: z.number().finite().min(-Math.PI).max(Math.PI),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid decoration color')
    .optional(),
});

export const aquariumAppearanceSchema = z.strictObject({
  // Null means no theme; optional preserves previously saved appearances.
  themeId: z
    .enum(['sunny-reef', 'ocean-garden', 'midnight-sea', 'magic-lagoon'])
    .nullable()
    .optional(),
  background: z.enum(['ocean', 'coral', 'deep-sea', 'fantasy']),
  substrate: z.enum(['sand', 'pebbles', 'dark-gravel', 'white-sand']),
  decorations: z.array(z.enum(['rocks', 'driftwood', 'green-plants', 'red-coral', 'cave'])).max(30),
  decorationInstances: z.array(aquariumDecorationInstanceSchema).max(30).optional(),
  lighting: z.enum(['sunny', 'soft', 'night']),
  bubbles: z.enum(['none', 'some', 'lots']),
});

export const updateAquariumSchema = z
  .strictObject({
    name: aquariumNameSchema.optional(),
    appearance: aquariumAppearanceSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.appearance !== undefined, {
    message: 'Provide a name or appearance to update',
  });
