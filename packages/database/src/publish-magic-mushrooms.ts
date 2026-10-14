import { prisma } from './index.js';
import type { Prisma } from './generated/prisma/client.js';
import { themeDefinitionSchema } from '@aquarium/aquarium-engine/content';

const slug = 'magic-lagoon';
const definition = themeDefinitionSchema.parse({
  schemaVersion: 2,
  id: slug,
  name: 'Magic Lagoon',
  emoji: '✨',
  appearance: {
    background: 'fantasy', substrate: 'pebbles', lighting: 'soft', bubbles: 'lots',
  },
  scenery: [
    { id: 'lagoon-mushrooms-left', assetId: 'glow-mushroom', x: 0.14, depth: 0.5, scale: 1.28, rotation: -0.12, color: '#d18aff' },
    { id: 'lagoon-fan-pink', assetId: 'reef-fan', x: 0.34, depth: 0.5, scale: 1.35, rotation: 0.1, color: '#fa7ebf' },
    { id: 'lagoon-grass-center', assetId: 'seagrass', x: 0.52, depth: 0.5, scale: 1.06, rotation: 0, color: '#66d8b6' },
    { id: 'lagoon-fan-purple', assetId: 'reef-fan', x: 0.71, depth: 0.5, scale: 1.25, rotation: -0.15, color: '#bc8cf3' },
    { id: 'lagoon-mushrooms-right', assetId: 'glow-mushroom', x: 0.87, depth: 0.5, scale: 1.18, rotation: 0.14, color: '#80e8ed' },
  ],
});

async function main() {
  await prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.findUnique({ where: { type_slug: { type: 'THEME', slug } } });
    if (!item || !item.publishedVersionId) throw new Error('Publish Magic Lagoon v1 before upgrading it');
    const current = await tx.contentVersion.findUniqueOrThrow({ where: { id: item.publishedVersionId } });
    if (current.version >= 2) {
      console.log(`magic-lagoon: already at version ${current.version}, skipped`);
      return;
    }
    const version = await tx.contentVersion.create({
      data: {
        contentItemId: item.id,
        version: 2,
        schemaVersion: 2,
        definition: { type: 'THEME', data: definition } as Prisma.InputJsonValue,
      },
    });
    await tx.contentItem.update({
      where: { id: item.id },
      data: { status: 'PUBLISHED', publishedVersionId: version.id },
    });
    console.log('magic-lagoon: published version 2 with glowing mushrooms');
  });
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
