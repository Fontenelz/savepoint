-- Foto/nome vindos das contas conectadas (Steam > Google).
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "googleName" TEXT;
ALTER TABLE "User" ADD COLUMN "googleAvatar" TEXT;

-- Quem já vinculou a Steam passa a usar a foto e o nome dela.
UPDATE "User" SET "avatarUrl" = "steamAvatar" WHERE "steamId" IS NOT NULL AND "steamAvatar" IS NOT NULL;
UPDATE "User" SET "displayName" = LEFT("steamName", 40) WHERE "steamId" IS NOT NULL AND NULLIF(TRIM("steamName"), '') IS NOT NULL;
