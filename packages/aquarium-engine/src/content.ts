import { z } from 'zod';

export const contentTypeSchema = z.enum(['THEME', 'FISH_SPECIES', 'DECORATION']);
export const contentStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const appearanceSchema = z.strictObject({
  background: z.enum(['ocean', 'coral', 'deep-sea', 'fantasy']),
  substrate: z.enum(['sand', 'pebbles', 'dark-gravel', 'white-sand']),
  lighting: z.enum(['sunny', 'soft', 'night']),
  bubbles: z.enum(['none', 'some', 'lots']),
});

export const themeSceneryAssetSchema = z.enum([
  'reef-fan',
  'reef-arch',
  'kelp',
  'seagrass',
  'glow-plant',
]);

export const themeSceneryInstanceSchema = z.strictObject({
  id: z.string().min(1),
  assetId: themeSceneryAssetSchema,
  x: z.number().min(0).max(1),
  depth: z.number().min(0).max(1),
  scale: z.number().positive().max(5),
  rotation: z.number().finite(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const themeBaseSchema = {
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().min(1),
  appearance: appearanceSchema,
};

export const themeDefinitionSchema = z.discriminatedUnion(
  'schemaVersion',
  [
    z.strictObject({
      schemaVersion: z.literal(1),
      ...themeBaseSchema,
    }),
    z.strictObject({
      schemaVersion: z.literal(2),
      ...themeBaseSchema,
      scenery: z.array(themeSceneryInstanceSchema).max(30),
    }),
  ],
);

export const fishSpeciesDefinitionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  rendererId: z.string().min(1),
});

export const decorationDefinitionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  rendererId: z.string().min(1),
});

export const contentDefinitionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('THEME'), data: themeDefinitionSchema }),
  z.strictObject({ type: z.literal('FISH_SPECIES'), data: fishSpeciesDefinitionSchema }),
  z.strictObject({ type: z.literal('DECORATION'), data: decorationDefinitionSchema }),
]);

export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;
export type ContentDefinition = z.infer<typeof contentDefinitionSchema>;
