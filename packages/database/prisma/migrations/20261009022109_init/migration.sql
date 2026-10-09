-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aquarium" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Aquarium',
    "ownerId" TEXT NOT NULL,
    "themeId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aquarium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fish" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL DEFAULT 'classic',
    "bodyColor" TEXT NOT NULL DEFAULT '#4F9CF9',
    "finColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "paintKey" TEXT,
    "size" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ownerId" TEXT NOT NULL,
    "aquariumId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Aquarium_ownerId_idx" ON "Aquarium"("ownerId");

-- CreateIndex
CREATE INDEX "Fish_ownerId_idx" ON "Fish"("ownerId");

-- CreateIndex
CREATE INDEX "Fish_aquariumId_idx" ON "Fish"("aquariumId");

-- AddForeignKey
ALTER TABLE "Aquarium" ADD CONSTRAINT "Aquarium_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fish" ADD CONSTRAINT "Fish_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fish" ADD CONSTRAINT "Fish_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
