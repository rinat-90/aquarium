
import { prisma } from '@aquarium/database';

export async function ensureDefaultAquarium(ownerId: string) {
  return prisma.$transaction(async (tx) => {
    // Serialize aquarium initialization for this user.
    // The user row acts as a per-user database lock.
    const users = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "User"
      WHERE id = ${ownerId}
      FOR UPDATE
    `;

    if (users.length === 0) {
      throw new Error('User not found');
    }

    // Prefer the existing default aquarium.
    const defaultAquarium = await tx.aquarium.findFirst({
      where: {
        ownerId,
        isDefault: true,
      },
    });

    if (defaultAquarium) {
      return defaultAquarium;
    }

    // Reuse an existing aquarium rather than creating another.
    const existingAquarium = await tx.aquarium.findFirst({
      where: {
        ownerId,
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });

    if (existingAquarium) {
      return tx.aquarium.update({
        where: {
          id: existingAquarium.id,
        },
        data: {
          isDefault: true,
        },
      });
    }

    // First aquarium for a new user.
    return tx.aquarium.create({
      data: {
        name: 'My Aquarium',
        ownerId,
        isDefault: true,
      },
    });
  });
}
