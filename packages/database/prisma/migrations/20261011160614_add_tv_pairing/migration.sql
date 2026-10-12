-- CreateTable
CREATE TABLE "TvPairingSession" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "aquariumId" TEXT,
    "approvedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "TvPairingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvDisplaySession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "TvDisplaySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TvPairingSession_codeHash_key" ON "TvPairingSession"("codeHash");

-- CreateIndex
CREATE INDEX "TvPairingSession_expiresAt_idx" ON "TvPairingSession"("expiresAt");

-- CreateIndex
CREATE INDEX "TvPairingSession_status_idx" ON "TvPairingSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TvDisplaySession_tokenHash_key" ON "TvDisplaySession"("tokenHash");

-- CreateIndex
CREATE INDEX "TvDisplaySession_aquariumId_idx" ON "TvDisplaySession"("aquariumId");

-- CreateIndex
CREATE INDEX "TvDisplaySession_ownerId_idx" ON "TvDisplaySession"("ownerId");

-- CreateIndex
CREATE INDEX "TvDisplaySession_expiresAt_idx" ON "TvDisplaySession"("expiresAt");
