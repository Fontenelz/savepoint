/** Converte nota 1–10 em estrelas: 7 → "★★★½". */
export function ratingToStars(rating: number | null | undefined): string {
  if (!rating) return '';
  const full = Math.floor(rating / 2);
  return '★'.repeat(full) + (rating % 2 ? '½' : '');
}

/** Média 1–10 → "3,8" (escala de 5). */
export function formatAvg(avg: number | null | undefined): string {
  if (avg == null) return '–';
  return (avg / 2).toFixed(1).replace('.', ',');
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '–';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${Math.round(hours)}h`;
}
