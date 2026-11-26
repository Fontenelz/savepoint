-- Sugestão de jogo "sem fim" (esportes, MMO, só multijogador). Só destaca o status "Sem fim":
-- a escolha continua sendo do jogador.
ALTER TABLE "Game" ADD COLUMN "endlessHint" BOOLEAN NOT NULL DEFAULT false;

-- Preenche pelos gêneros já cadastrados e pela curadoria (jogo curado sem tempo para zerar:
-- Minecraft, Mario Kart). Os sinais da loja da Steam (MMO, só multijogador) entram com
-- `pnpm catalog:endless`.
UPDATE "Game" g SET "endlessHint" = true
WHERE (g.source = 'LOCAL' AND g."avgHours" IS NULL)
OR EXISTS (
  SELECT 1 FROM "_GameToGenre" gg JOIN "Genre" ge ON ge.id = gg."B"
  WHERE gg."A" = g.id AND ge.slug IN ('esportes', 'multijogador-massivo')
);
