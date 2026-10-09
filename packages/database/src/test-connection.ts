import { prisma } from './index.js';

async function main() {
  await prisma.$connect();

  const userCount = await prisma.user.count();
  const aquariumCount = await prisma.aquarium.count();
  const fishCount = await prisma.fish.count();

  console.log('Database connected successfully!');
  console.log({
    users: userCount,
    aquariums: aquariumCount,
    fish: fishCount,
  });
}

main()
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });