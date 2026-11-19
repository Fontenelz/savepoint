export const PLAY_STATUSES = [
  'BACKLOG',
  'PLAYING',
  'PAUSED',
  'COMPLETED',
  'MASTERED',
  'DROPPED',
  'ENDLESS',
] as const;

export type PlayStatus = (typeof PLAY_STATUSES)[number];

export const PLAY_STATUS_LABEL: Record<PlayStatus, string> = {
  BACKLOG: 'Quero jogar',
  PLAYING: 'Jogando',
  PAUSED: 'Pausado',
  COMPLETED: 'Zerado',
  MASTERED: '100%',
  DROPPED: 'Abandonado',
  ENDLESS: 'Sem fim',
};

/** Verbo usado no feed: "ana zerou Celeste". */
export const PLAY_STATUS_VERB: Record<PlayStatus, string> = {
  BACKLOG: 'quer jogar',
  PLAYING: 'está jogando',
  PAUSED: 'pausou',
  COMPLETED: 'zerou',
  MASTERED: 'fez 100% em',
  DROPPED: 'abandonou',
  ENDLESS: 'joga sem fim',
};

/** Status que contam como "jogado" (tudo menos backlog). */
export const PLAYED_STATUSES: PlayStatus[] = [
  'PLAYING',
  'PAUSED',
  'COMPLETED',
  'MASTERED',
  'DROPPED',
  'ENDLESS',
];

export const FINISHED_STATUSES: PlayStatus[] = ['COMPLETED', 'MASTERED'];

export const CATALOG_SOURCES = ['LOCAL', 'COMMUNITY', 'IGDB'] as const;
export type CatalogSource = (typeof CATALOG_SOURCES)[number];

export const GAME_SORTS = ['popular', 'rating', 'recent', 'title'] as const;
export type GameSort = (typeof GAME_SORTS)[number];

export const LIBRARY_FILTERS = ['all', 'played', 'liked', 'rated', ...PLAY_STATUSES] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

export const MAX_FAVORITES = 4;
