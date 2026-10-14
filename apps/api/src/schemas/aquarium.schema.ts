
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

  assetId: z.enum([
    'rocks',
    'seaweed',
    'coral',
  ]),

  // Normalized horizontal position.
  x: z.number().finite().min(0).max(1),

  // Normalized seabed depth.
  depth: z.number().finite().min(0).max(1),

  scale: z.number().finite().min(0.3).max(2),

  rotation: z.number().finite().min(-Math.PI).max(Math.PI),

  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid decoration color')
    .optional(),
});

export const aquariumAppearanceSchema = z.strictObject({
  background: z.enum([
    'ocean',
    'coral',
    'deep-sea',
    'fantasy',
  ]),

  substrate: z.enum([
    'sand',
    'pebbles',
    'dark-gravel',
    'white-sand',
  ]),

  // Legacy decoration selections.
  // Retained for existing aquarium compatibility.
  decorations: z.array(
    z.enum([
      'rocks',
      'driftwood',
      'green-plants',
      'red-coral',
      'cave',
    ]),
  ).max(30),

  // New individually customizable 3D decorations.
  // Optional to support existing saved appearances.
  decorationInstances: z
    .array(aquariumDecorationInstanceSchema)
    .max(30)
    .optional(),

  lighting: z.enum([
    'sunny',
    'soft',
    'night',
  ]),

  bubbles: z.enum([
    'none',
    'some',
    'lots',
  ]),
});

export const updateAquariumSchema = z
  .strictObject({
    name: aquariumNameSchema.optional(),
    appearance: aquariumAppearanceSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.appearance !== undefined,
    {
      message: 'Provide a name or appearance to update',
    },
  );
