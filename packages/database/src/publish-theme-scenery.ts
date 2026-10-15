import { prisma } from './index.js';
import type { Prisma } from './generated/prisma/client.js';
import { themeDefinitionSchema } from '@aquarium/aquarium-engine/content';

const scenery = {
  'sunny-reef': [
    {
      id: 'reef-arch-left',
      assetId: 'reef-arch',
      x: 0.17,
      depth: 0.5,
      scale: 1.3,
      rotation: -0.12,
      color: '#9e94a4',
    },
    {
      id: 'reef-fan-pink',
      assetId: 'reef-fan',
      x: 0.32,
      depth: 0.5,
      scale: 1.4,
      rotation: 0.12,
      color: '#ff729e',
    },
    {
      id: 'reef-fan-orange',
      assetId: 'reef-fan',
      x: 0.72,
      depth: 0.5,
      scale: 1.2,
      rotation: -0.2,
      color: '#ffab5d',
    },
    {
      id: 'reef-arch-right',
      assetId: 'reef-arch',
      x: 0.88,
      depth: 0.5,
      scale: 1.1,
      rotation: 0.15,
      color: '#b7a1ad',
    },
  ],
  'ocean-garden': [
    {
      id: 'garden-kelp-left',
      assetId: 'kelp',
      x: 0.13,
      depth: 0.5,
      scale: 1.35,
      rotation: -0.08,
      color: '#2ca986',
    },
    {
      id: 'garden-grass-left',
      assetId: 'seagrass',
      x: 0.29,
      depth: 0.5,
      scale: 1.1,
      rotation: 0,
      color: '#75d99d',
    },
    {
      id: 'garden-kelp-center',
      assetId: 'kelp',
      x: 0.49,
      depth: 0.5,
      scale: 1.12,
      rotation: 0.1,
      color: '#278a7a',
    },
    {
      id: 'garden-grass-right',
      assetId: 'seagrass',
      x: 0.7,
      depth: 0.5,
      scale: 1.2,
      rotation: 0.1,
      color: '#55c9a0',
    },
    {
      id: 'garden-kelp-right',
      assetId: 'kelp',
      x: 0.87,
      depth: 0.5,
      scale: 1.4,
      rotation: 0.12,
      color: '#3ab28c',
    },
  ],
} as const;

async function main() {
  for (const [slug, instances] of Object.entries(scenery)) {
    await prisma.$transaction(async (tx) => {
      const item = await tx.contentItem.findUniqueOrThrow({
        where: { type_slug: { type: 'THEME', slug } },
        include: { versions: true },
      });

      const published = item.versions.find((version) => version.id === item.publishedVersionId);

      if (!published) {
        throw new Error(`No published version for ${slug}`);
      }

      // Idempotent: never publish another version if v2 is already active.
      if (published.schemaVersion === 2) {
        console.log(`${slug}: already on schema v2`);
        return;
      }

      const old = published.definition as {
        data?: {
          id: string;
          name: string;
          emoji: string;
          appearance: {
            background: 'ocean' | 'coral' | 'deep-sea' | 'fantasy';
            substrate: 'sand' | 'white-sand' | 'pebbles' | 'dark-gravel';
            lighting: 'sunny' | 'soft' | 'night';
            bubbles: 'none' | 'some' | 'lots';
          };
        };
      };

      if (!old.data) throw new Error(`Invalid published definition: ${slug}`);

      const definition = themeDefinitionSchema.parse({
        ...old.data,
        schemaVersion: 2,
        scenery: instances,
      });

      const nextVersion = Math.max(0, ...item.versions.map((version) => version.version)) + 1;

      const version = await tx.contentVersion.create({
        data: {
          contentItemId: item.id,
          version: nextVersion,
          schemaVersion: 2,
          definition: {
            type: 'THEME',
            data: definition,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.contentItem.update({
        where: { id: item.id },
        data: {
          publishedVersionId: version.id,
          status: 'PUBLISHED',
        },
      });

      console.log(`${slug}: published version ${nextVersion}`);
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
