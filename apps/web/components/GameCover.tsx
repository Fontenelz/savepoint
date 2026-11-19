import type { CSSProperties } from 'react';

type CoverGame = {
  slug: string;
  title: string;
  coverUrl: string | null;
  releaseYear?: number | null;
  platforms?: string[];
};

// [cor 1, cor 2, tinta] — paletas de "caixa de jogo"
const PALETTES: [string, string, string][] = [
  ['#ff5f3d', '#ffb13d', '#1c0b05'],
  ['#2b2dff', '#8a4dff', '#f0ecff'],
  ['#0fd1a6', '#127a8a', '#04201c'],
  ['#ff3d8b', '#7b2bff', '#fff0f7'],
  ['#ffd23d', '#ff8a1f', '#231502'],
  ['#14213d', '#355c9a', '#e9f0ff'],
  ['#c6ff3d', '#2fb36b', '#0d1a05'],
  ['#e8e3d3', '#b9ad8f', '#1b1811'],
  ['#5c0f1e', '#c2273d', '#ffe9ec'],
  ['#3df0ff', '#3d7bff', '#04152a'],
  ['#1d1d1f', '#46464f', '#ffcf3d'],
  ['#7cf2c3', '#f2e77c', '#10231a'],
  ['#ff9bd2', '#ffd6a5', '#2a0d1c'],
  ['#3a1c71', '#d76d77', '#fff1e8'],
];
const PATTERNS = ['stripes', 'dots', 'grid', 'rings', 'scan', 'sun'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Capa do jogo. Sem imagem, gera uma "box art" determinística a partir do slug —
 * o catálogo fica bonito sem depender de imagens de terceiros.
 */
export function GameCover({ game, className = '' }: { game: CoverGame; className?: string }) {
  if (game.coverUrl) {
    return (
      <div className={`cover ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={game.coverUrl} alt={game.title} loading="lazy" />
      </div>
    );
  }

  const h = hash(game.slug);
  const [c1, c2, ink] = PALETTES[h % PALETTES.length];
  const pattern = PATTERNS[(h >>> 5) % PATTERNS.length];
  const style = { '--c1': c1, '--c2': c2, '--ink': ink, '--ang': `${(h >>> 9) % 360}deg` } as CSSProperties;

  return (
    <div className={`cover cover-gen pat-${pattern} ${className}`} style={style} role="img" aria-label={game.title}>
      <span className="cover-band">{game.platforms?.[0] ?? 'Game'}</span>
      <div>
        <div className="cover-title">{game.title}</div>
        {game.releaseYear ? <div className="cover-year">{game.releaseYear}</div> : null}
      </div>
    </div>
  );
}
