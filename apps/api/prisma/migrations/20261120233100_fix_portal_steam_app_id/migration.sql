-- Portal foi importado do IGDB com o id da Steam de outra página (52003); o correto é 400.
-- Só mexe se ainda estiver errado. Zera as avaliações para o `pnpm catalog:enrich` buscar de novo.
UPDATE "Game"
SET "steamAppId" = '400', "steamScore" = NULL, "steamReviewCount" = NULL
WHERE "slug" = 'portal' AND "steamAppId" = '52003'
  AND NOT EXISTS (SELECT 1 FROM "Game" g WHERE g."steamAppId" = '400');
