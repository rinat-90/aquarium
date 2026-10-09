
import { prisma } from '@aquarium/database';

export async function ensureDefaultAquarium(ownerId: string) {
  const existing = await prisma.aquarium.findFirst({
    where: {
      ownerId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.aquarium.create({
    data: {
      name: 'My Aquarium',
      ownerId,
      isDefault: true,
    },
  });
}
