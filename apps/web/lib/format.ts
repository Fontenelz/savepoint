const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "2026-03-07" → "7 mar 2026" */
export function shortDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthLabel(iso: string) {
  const [y, m] = iso.slice(0, 10).split('-').map(Number);
  return { month: MONTHS_LONG[m - 1], year: y };
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `há ${Math.floor(diff / 86400)} d`;
  return shortDate(iso);
}

export function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;
}

/** Endereço público de uma review (página própria, com prévia de link). */
export function reviewPath(r: { id: string; user: { username: string } }) {
  return `/u/${r.user.username}/reviews/${r.id}`;
}
