-- Jogos criados a partir da loja da Steam (importação de biblioteca)
ALTER TYPE "CatalogSource" ADD VALUE 'STEAM';

-- Conta Steam vinculada ao usuário
ALTER TABLE "User" ADD COLUMN "steamId" TEXT,
ADD COLUMN "steamName" TEXT,
ADD COLUMN "steamAvatar" TEXT,
ADD COLUMN "steamLinkedAt" TIMESTAMP(3),
ADD COLUMN "steamSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");

-- Busca de jogos pelo app id da Steam
CREATE INDEX "Game_steamAppId_idx" ON "Game"("steamAppId");
