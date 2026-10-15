import { prisma } from './index.js';
import type { Prisma } from './generated/prisma/client.js';
import { themeDefinitionSchema } from '@aquarium/aquarium-engine/content';

// New worlds built from the four currently supported Three.js scenery assets.
// This command creates missing catalog items and publishes version 1 of each.
// It never changes an already-published item or existing aquarium records.
const themes = [
  {
    id: 'midnight-sea',
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
        id: 'midnight-kelp-left',
        assetId: 'kelp',
        x: 0.12,
        depth: 0.5,
        scale: 1.42,
        rotation: -0.12,
        color: '#596acb',
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
        id: 'midnight-kelp-right',
        assetId: 'kelp',
        x: 0.89,
        depth: 0.5,
        scale: 1.3,
        rotation: 0.13,
        color: '#427cbb',
      },
    ],
  },
  {
    id: 'magic-lagoon',
    name: 'Magic Lagoon',
    emoji: '✨',
    appearance: {
      background: 'fantasy',
      substrate: 'pebbles',
      lighting: 'soft',
      bubbles: 'lots',
    },
    scenery: [
      {
        id: 'lagoon-arch-left',
        assetId: 'reef-arch',
        x: 0.19,
        depth: 0.5,
        scale: 1.1,
        rotation: -0.1,
        color: '#ae86d1',
      },
      {
        id: 'lagoon-fan-pink',
        assetId: 'reef-fan',
        x: 0.34,
        depth: 0.5,
        scale: 1.35,
        rotation: 0.1,
        color: '#fa7ebf',
      },
      {
        id: 'lagoon-grass-center',
        assetId: 'seagrass',
        x: 0.52,
        depth: 0.5,
        scale: 1.06,
        rotation: 0,
        color: '#66d8b6',
      },
      {
        id: 'lagoon-fan-purple',
        assetId: 'reef-fan',
        x: 0.71,
        depth: 0.5,
        scale: 1.25,
        rotation: -0.15,
        color: '#bc8cf3',
      },
      {
        id: 'lagoon-arch-right',
        assetId: 'reef-arch',
        x: 0.87,
        depth: 0.5,
        scale: 1.05,
        rotation: 0.14,
        color: '#d7a2c7',
      },
    ],
  },
] as const;

async function main() {
  for (const theme of themes) {
    const definition = themeDefinitionSchema.parse({ schemaVersion: 2, ...theme });
    await prisma.$transaction(async (tx) => {
      const item = await tx.contentItem.upsert({
        where: { type_slug: { type: 'THEME', slug: theme.id } },
        create: { type: 'THEME', slug: theme.id, name: theme.name },
        update: {},
      });
      if (item.publishedVersionId) {
        console.log(`${theme.id}: already published, skipped`);
        return;
      }
      let version = await tx.contentVersion.findUnique({
        where: { contentItemId_version: { contentItemId: item.id, version: 1 } },
      });
      if (!version) {
        version = await tx.contentVersion.create({
          data: {
            contentItemId: item.id,
            version: 1,
            schemaVersion: 2,
            definition: { type: 'THEME', data: definition } as Prisma.InputJsonValue,
          },
        });
      } else {
        // Don't silently publish a pre-existing draft that may differ.
        throw new Error(
          `${theme.id}: version 1 already exists as a draft; review it before publishing`,
        );
      }
      await tx.contentItem.update({
        where: { id: item.id },
        data: { status: 'PUBLISHED', publishedVersionId: version.id },
      });
      console.log(`${theme.id}: published version 1 (schema v2)`);
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
