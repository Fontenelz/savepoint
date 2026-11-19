-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "backdropUrl" TEXT,
ADD COLUMN     "igdbId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Game_igdbId_key" ON "Game"("igdbId");

