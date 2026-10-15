import { prisma } from './index.js';
import type { Prisma } from './generated/prisma/client.js';

// Standalone, idempotent seed. Does not create users or modify existing aquariums.
const themes = [
  {
    id: 'sunny-reef',
    name: 'Sunny Reef',
    emoji: '☀️',
    appearance: {
      background: 'coral',
      substrate: 'white-sand',
      lighting: 'sunny',
      bubbles: 'lots',
    },
  },
  {
    id: 'ocean-garden',
    name: 'Ocean Garden',
    emoji: '🌿',
    appearance: { background: 'ocean', substrate: 'sand', lighting: 'soft', bubbles: 'some' },
  },
] as const;

async function main() {
  for (const theme of themes) {
    const definition = { type: 'THEME', data: { schemaVersion: 1, ...theme } };
    await prisma.$transaction(async (tx) => {
      const item = await tx.contentItem.upsert({
        where: { type_slug: { type: 'THEME', slug: theme.id } },
        create: { type: 'THEME', slug: theme.id, name: theme.name },
        update: {},
      });
      // Never overwrite an existing published definition or append duplicate versions.
      if (item.publishedVersionId) return;
      let version = await tx.contentVersion.findUnique({
        where: { contentItemId_version: { contentItemId: item.id, version: 1 } },
      });
      if (!version) {
        version = await tx.contentVersion.create({
          data: {
            contentItemId: item.id,
            version: 1,
            schemaVersion: 1,
            definition: definition as Prisma.InputJsonValue,
          },
        });
      }
      await tx.contentItem.update({
        where: { id: item.id },
        data: { status: 'PUBLISHED', publishedVersionId: version.id },
      });
    });
    console.log(`Seeded content theme: ${theme.id}`);
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
