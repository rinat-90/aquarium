import { prisma } from './index.js';

async function main() {
  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: 'demo@aquarium.local',
        name: 'Demo Parent',
      },
    });

    const aquarium = await tx.aquarium.create({
      data: {
        name: 'My First Aquarium',
        ownerId: user.id,
        isDefault: true,
      },
    });

    await tx.fish.create({
      data: {
        name: 'Bubbles',
        species: 'classic',
        bodyColor: '#4F9CF9',
        finColor: '#3B82F6',
        ownerId: user.id,
        aquariumId: aquarium.id,
      },
    });

    return user;
  });

  console.log(`Created demo user: ${user.email}`);

  const result = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      aquariums: true,
      fish: true,
    },
  });

  console.dir(result, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });