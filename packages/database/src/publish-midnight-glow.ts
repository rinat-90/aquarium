import { prisma } from './index.js';
import type { Prisma } from './generated/prisma/client.js';
import { themeDefinitionSchema } from '@aquarium/aquarium-engine/content';

const slug = 'midnight-sea';
const definition = themeDefinitionSchema.parse({
  schemaVersion: 2,
  id: slug,
  name: 'Midnight Sea',
  emoji: '🌙',
  appearance: {
    background: 'deep-sea',
    substrate: 'dark-gravel',
    lighting: 'night',
    bubbles: 'some',
  },
  scenery: [
    {
      id: 'midnight-glow-left',
      assetId: 'glow-plant',
      x: 0.13,
      depth: 0.5,
      scale: 1.28,
      rotation: -0.1,
      color: '#608cff',
    },
    {
      id: 'midnight-grass-left',
      assetId: 'seagrass',
      x: 0.31,
      depth: 0.5,
      scale: 1.04,
      rotation: 0.06,
      color: '#8769bd',
    },
    {
      id: 'midnight-arch',
      assetId: 'reef-arch',
      x: 0.52,
      depth: 0.5,
      scale: 1.08,
      rotation: 0.08,
      color: '#4a5b8a',
    },
    {
      id: 'midnight-fan',
      assetId: 'reef-fan',
      x: 0.72,
      depth: 0.5,
      scale: 1.17,
      rotation: -0.13,
      color: '#a179d3',
    },
    {
      id: 'midnight-glow-right',
      assetId: 'glow-plant',
      x: 0.89,
      depth: 0.5,
      scale: 1.2,
      rotation: 0.13,
      color: '#b06dff',
    },
  ],
});

async function main() {
  await prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.findUnique({ where: { type_slug: { type: 'THEME', slug } } });
    if (!item || !item.publishedVersionId)
      throw new Error('Publish Midnight Sea v1 before upgrading it');
    const current = await tx.contentVersion.findUniqueOrThrow({
      where: { id: item.publishedVersionId },
    });
    if (current.version >= 2) {
      console.log(`midnight-sea: already at version ${current.version}, skipped`);
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
    console.log('midnight-sea: published version 2 with glow plants');
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
