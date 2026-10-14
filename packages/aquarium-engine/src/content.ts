import { z } from 'zod';

export const contentTypeSchema = z.enum(['THEME', 'FISH_SPECIES', 'DECORATION']);
export const contentStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const appearanceSchema = z.strictObject({
  background: z.enum(['ocean', 'coral', 'deep-sea', 'fantasy']),
  substrate: z.enum(['sand', 'pebbles', 'dark-gravel', 'white-sand']),
  lighting: z.enum(['sunny', 'soft', 'night']),
  bubbles: z.enum(['none', 'some', 'lots']),
});

export const themeDefinitionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().min(1),
  appearance: appearanceSchema,
  // Theme-owned scenery is still rendered from the existing local registry.
  // We will move it into catalog definitions in the next milestone.
});

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
