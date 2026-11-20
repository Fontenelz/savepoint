-- AlterEnum
ALTER TYPE "CatalogSource" ADD VALUE 'RAWG';
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "rawgId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "Game_rawgId_key" ON "Game"("rawgId");
