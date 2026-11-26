-- Jornada do jogador: Save (jornada) + checkpoints (LogEntry).
-- Converte os registros antigos (cada LogEntry com nota/review) para o modelo novo:
--   * os registros de cada usuário+jogo, em ordem, formam o Save 1; cada "replay" abre um save novo;
--   * o último save recebe o status da estante; os anteriores ficam Zerado (se tiveram "zerei") ou Abandonado;
--   * nota/review do save = do último registro com review (senão, do último com nota); curtidas e
--     respostas dessa review passam para o save. Outras reviews do mesmo save viram anotação do checkpoint;
--   * jogos com status de jogado e sem nenhum registro ganham um Save 1 com os dados da estante.
-- A nota oficial (UserGame.rating) não muda. As colunas antigas de LogEntry ficam (legado).

BEGIN;

CREATE TYPE "CheckpointKind" AS ENUM ('SESSION', 'STARTED', 'CLOSED');

CREATE TABLE "Save" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "PlayStatus" NOT NULL,
    "startedAt" DATE,
    "endedAt" DATE,
    "platformId" TEXT,
    "hours" DOUBLE PRECISION,
    "rating" INTEGER,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "review" TEXT,
    "spoiler" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Save_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LogEntry"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "kind" "CheckpointKind" NOT NULL DEFAULT 'SESSION',
  ADD COLUMN "note" TEXT,
  ADD COLUMN "saveId" TEXT;

ALTER TABLE "ReviewLike" ADD COLUMN "saveId" TEXT;
ALTER TABLE "ReviewComment" ADD COLUMN "saveId" TEXT;

-- 1. Número do save de cada registro.
CREATE TEMP TABLE _log_save AS
SELECT id, "userId", "gameId",
       1 + SUM(CASE WHEN replay THEN 1 ELSE 0 END) OVER w
         - CASE WHEN FIRST_VALUE(replay) OVER w THEN 1 ELSE 0 END AS number
FROM "LogEntry"
WINDOW w AS (PARTITION BY "userId", "gameId" ORDER BY "playedOn", "createdAt", id ROWS UNBOUNDED PRECEDING);

-- 2. Um save por (usuário, jogo, número).
CREATE TEMP TABLE _save AS
SELECT 'sv_' || md5(l."userId" || ':' || l."gameId" || ':' || s.number) AS id,
       l."userId", l."gameId", s.number,
       MIN(l."playedOn") AS "startedAt",
       MAX(l."playedOn") AS "lastOn",
       MAX(l."playedOn") FILTER (WHERE l.finished) AS "finishedOn",
       BOOL_OR(l.finished) AS finished,
       MAX(l.hours) AS hours,
       MIN(l."createdAt") AS "createdAt"
FROM "LogEntry" l JOIN _log_save s ON s.id = l.id
GROUP BY l."userId", l."gameId", s.number;

INSERT INTO "Save" ("id", "userId", "gameId", "number", "status", "startedAt", "endedAt", "platformId", "hours", "createdAt", "updatedAt")
SELECT s.id, s."userId", s."gameId", s.number,
       CASE
         WHEN s.number = MAX(s.number) OVER (PARTITION BY s."userId", s."gameId")
              AND ug.status IS NOT NULL AND ug.status <> 'BACKLOG' THEN ug.status
         WHEN s.finished THEN 'COMPLETED'::"PlayStatus"
         ELSE 'DROPPED'::"PlayStatus"
       END,
       s."startedAt",
       NULL,
       (SELECT l."platformId" FROM "LogEntry" l JOIN _log_save x ON x.id = l.id
         WHERE x."userId" = s."userId" AND x."gameId" = s."gameId" AND x.number = s.number AND l."platformId" IS NOT NULL
         ORDER BY l."playedOn" DESC, l."createdAt" DESC LIMIT 1),
       s.hours, s."createdAt", CURRENT_TIMESTAMP
FROM _save s
LEFT JOIN "UserGame" ug ON ug."userId" = s."userId" AND ug."gameId" = s."gameId";

-- Data de fim dos saves fechados: a zerada, ou o último registro; no save atual, a da estante se houver.
UPDATE "Save" sv SET "endedAt" = COALESCE(
    CASE WHEN ug."finishedAt" IS NOT NULL AND sv.number = (SELECT MAX(number) FROM "Save" o WHERE o."userId" = sv."userId" AND o."gameId" = sv."gameId")
         THEN ug."finishedAt" END,
    s."finishedOn", s."lastOn")
FROM _save s
LEFT JOIN "UserGame" ug ON ug."userId" = s."userId" AND ug."gameId" = s."gameId"
WHERE s.id = sv.id AND sv.status IN ('COMPLETED', 'MASTERED', 'DROPPED');

-- 3. Checkpoints apontam para o save; registros de "zerei" viram o checkpoint de fechamento.
UPDATE "LogEntry" l
SET "saveId" = 'sv_' || md5(x."userId" || ':' || x."gameId" || ':' || x.number),
    "kind" = CASE WHEN l.finished THEN 'CLOSED'::"CheckpointKind" ELSE 'SESSION'::"CheckpointKind" END,
    "note" = l.review
FROM _log_save x WHERE x.id = l.id;

-- 4. Nota/review de cada save: último registro com review; sem review, último com nota.
CREATE TEMP TABLE _pick AS
SELECT DISTINCT ON (l."saveId") l."saveId", l.id AS "logId", l.rating, l.liked, l.review, l.spoiler, l."createdAt"
FROM "LogEntry" l
WHERE l.review IS NOT NULL OR l.rating IS NOT NULL
ORDER BY l."saveId", (l.review IS NOT NULL) DESC, l."playedOn" DESC, l."createdAt" DESC;

UPDATE "Save" sv
SET rating = p.rating, liked = p.liked, review = p.review,
    spoiler = CASE WHEN p.review IS NOT NULL THEN p.spoiler ELSE false END,
    "reviewedAt" = CASE WHEN p.review IS NOT NULL THEN p."createdAt" END
FROM _pick p WHERE p."saveId" = sv.id;

-- O texto escolhido agora é a review do save: sai da anotação do checkpoint.
UPDATE "LogEntry" l SET note = NULL, spoiler = false
FROM _pick p WHERE p."logId" = l.id AND p.review IS NOT NULL;

-- 5. Curtidas e respostas seguem a review escolhida; as das demais são descartadas.
UPDATE "ReviewLike" r SET "saveId" = p."saveId" FROM _pick p WHERE p."logId" = r."logId" AND p.review IS NOT NULL;
UPDATE "ReviewComment" c SET "saveId" = p."saveId" FROM _pick p WHERE p."logId" = c."logId" AND p.review IS NOT NULL;
DELETE FROM "ReviewLike" WHERE "saveId" IS NULL;
DELETE FROM "ReviewComment" WHERE "saveId" IS NULL;

-- 6. Jogos com status de jogado e sem registro: Save 1 a partir da estante.
INSERT INTO "Save" ("id", "userId", "gameId", "number", "status", "startedAt", "endedAt", "platformId", "hours", "rating", "liked", "createdAt", "updatedAt")
SELECT 'sv_' || md5(ug."userId" || ':' || ug."gameId" || ':1'), ug."userId", ug."gameId", 1, ug.status,
       ug."startedAt",
       CASE WHEN ug.status IN ('COMPLETED', 'MASTERED', 'DROPPED') THEN ug."finishedAt" END,
       ug."platformId", ug."hoursPlayed",
       CASE WHEN ug.status IN ('COMPLETED', 'MASTERED', 'DROPPED', 'ENDLESS') THEN ug.rating END,
       ug.liked, ug."createdAt", CURRENT_TIMESTAMP
FROM "UserGame" ug
WHERE ug.status IS NOT NULL AND ug.status <> 'BACKLOG'
  AND NOT EXISTS (SELECT 1 FROM "Save" s WHERE s."userId" = ug."userId" AND s."gameId" = ug."gameId");

-- 7. Restrições.
ALTER TABLE "LogEntry" ALTER COLUMN "saveId" SET NOT NULL;
ALTER TABLE "ReviewLike" ALTER COLUMN "saveId" SET NOT NULL;
ALTER TABLE "ReviewComment" ALTER COLUMN "saveId" SET NOT NULL;

ALTER TABLE "ReviewComment" DROP CONSTRAINT "ReviewComment_logId_fkey";
ALTER TABLE "ReviewLike" DROP CONSTRAINT "ReviewLike_logId_fkey";
DROP INDEX "ReviewComment_logId_createdAt_idx";
ALTER TABLE "ReviewComment" DROP COLUMN "logId";
ALTER TABLE "ReviewLike" DROP CONSTRAINT "ReviewLike_pkey", DROP COLUMN "logId",
  ADD CONSTRAINT "ReviewLike_pkey" PRIMARY KEY ("userId", "saveId");

CREATE INDEX "Save_gameId_reviewedAt_idx" ON "Save"("gameId", "reviewedAt");
CREATE INDEX "Save_userId_reviewedAt_idx" ON "Save"("userId", "reviewedAt");
CREATE UNIQUE INDEX "Save_userId_gameId_number_key" ON "Save"("userId", "gameId", "number");
CREATE INDEX "LogEntry_saveId_playedOn_idx" ON "LogEntry"("saveId", "playedOn");
CREATE INDEX "ReviewComment_saveId_createdAt_idx" ON "ReviewComment"("saveId", "createdAt");

ALTER TABLE "Save" ADD CONSTRAINT "Save_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Save" ADD CONSTRAINT "Save_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Save" ADD CONSTRAINT "Save_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewLike" ADD CONSTRAINT "ReviewLike_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE _log_save, _save, _pick;

COMMIT;
