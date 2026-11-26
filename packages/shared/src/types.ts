import type { CatalogSource, CheckpointKind, PlayStatus } from './enums';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarHue: number;
  /** Foto da conta Steam (ou Google); null → silhueta. */
  avatarUrl: string | null;
}

export interface Viewer extends UserSummary {
  email: string;
  /** Conta Steam vinculada. Só vem em GET /auth/me (o login/cadastro não preenche). */
  steamLinked?: boolean;
  /** Conta Google conectada. Só vem em GET /auth/me. */
  googleLinked?: boolean;
}

/** Conta Steam mostrada publicamente no perfil (selo com link). */
export interface ProfileSteam {
  name: string | null;
  profileUrl: string;
}

export interface AuthResponse {
  token: string;
  user: Viewer;
}

export interface GoogleAuthResponse extends AuthResponse {
  /** Conta criada agora (primeiro login com Google). */
  created: boolean;
}

export interface Genre {
  id: string;
  slug: string;
  name: string;
}

export interface Platform {
  id: string;
  slug: string;
  name: string;
  short: string;
}

export interface GameSummary {
  id: string;
  slug: string;
  title: string;
  releaseYear: number | null;
  coverUrl: string | null;
  developer: string | null;
  /** Média de 1 a 10. */
  ratingAvg: number | null;
  platforms: string[];
  genre: string | null;
}

export interface UserGameState {
  status: PlayStatus | null;
  rating: number | null;
  liked: boolean;
  favoriteRank: number | null;
  platformId: string | null;
  hoursPlayed: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  /**
   * Nota sugerida a partir das avaliações da Steam, para jogos já jogados que ainda não têm nota.
   * Não é a nota do usuário: não entra em médias até ele confirmar (gravando em `rating`).
   */
  suggested: { rating: number; steamScore: number } | null;
  /** Save atual depois da mudança. Só vem em PUT /library/:gameId. */
  save?: ViewerSave | null;
}

/** Resumo de um save (uma jornada com o jogo). */
export interface SaveSummary {
  id: string;
  /** 1, 2, 3… (Save 2 = rejogou uma vez) */
  number: number;
  status: PlayStatus;
  startedAt: string | null;
  endedAt: string | null;
  rating: number | null;
  hasReview: boolean;
}

/** Checkpoint do diário (sessão, início ou fechamento de um save). */
export interface CheckpointView {
  id: string;
  kind: CheckpointKind;
  playedOn: string;
  hours: number | null;
  platform: string | null;
  note: string | null;
  spoiler: boolean;
  isPublic: boolean;
  createdAt: string;
  save: SaveSummary;
  user: UserSummary;
  game: GameSummary;
}

/** Review = avaliação de um save fechado. O id é o do save. */
export interface ReviewView {
  id: string;
  save: SaveSummary;
  rating: number | null;
  liked: boolean;
  review: string | null;
  spoiler: boolean;
  /** Quando foi publicada. */
  createdAt: string;
  platform: string | null;
  hours: number | null;
  user: UserSummary;
  game: GameSummary;
  likeCount: number;
  viewerLiked: boolean;
  commentCount: number;
}

/** Save atual do usuário logado num jogo (painel da página do jogo). */
export interface ViewerSave extends SaveSummary {
  review: string | null;
  spoiler: boolean;
  liked: boolean;
  checkpointCount: number;
}

export interface ReviewComment {
  id: string;
  body: string;
  createdAt: string;
  user: UserSummary;
  /** O usuário logado pode apagar (autor da resposta ou dono da review). */
  canDelete: boolean;
}

/** Estado de um jogo para o usuário logado, usado para marcar capas em listagens. */
export interface ViewerGameMark {
  status: PlayStatus | null;
  rating: number | null;
  liked: boolean;
  inList: boolean;
}

export interface ListSummary {
  id: string;
  title: string;
  description: string | null;
  ranked: boolean;
  updatedAt: string;
  user: UserSummary;
  itemCount: number;
  preview: GameSummary[];
}

export interface ListDetail extends ListSummary {
  isOwner: boolean;
  items: { position: number; note: string | null; game: GameSummary }[];
}

export interface FriendEntry {
  user: UserSummary;
  status: PlayStatus | null;
  rating: number | null;
  liked: boolean;
}

export interface GameDetail extends GameSummary {
  summary: string | null;
  publisher: string | null;
  avgHours: number | null;
  backdropUrl: string | null;
  /** Para o link "Ver na Steam". */
  steamAppId: string | null;
  source: CatalogSource;
  genres: Genre[];
  platformList: Platform[];
  createdBy: UserSummary | null;
  stats: {
    ratingAvg: number | null;
    ratingCount: number;
    histogram: number[];
    statusCounts: Record<PlayStatus, number>;
    playerCount: number;
    likeCount: number;
    listCount: number;
    logCount: number;
    communityHours: number | null;
  };
  viewer: UserGameState | null;
  /** Save atual (o mais recente) do usuário logado; null se nunca começou. */
  viewerSave: ViewerSave | null;
  popularReviews: ReviewView[];
  recentReviews: ReviewView[];
  lists: ListSummary[];
  friends: FriendEntry[];
  /** Jogos parecidos (gêneros e plataformas em comum). */
  similar: GameSummary[];
}

export interface ProfileCounts {
  played: number;
  completed: number;
  backlog: number;
  thisYear: number;
  hours: number;
  reviews: number;
  lists: number;
  followers: number;
  following: number;
}

export interface Profile {
  user: UserSummary & { bio: string | null; createdAt: string; steam: ProfileSteam | null };
  isMe: boolean;
  viewerFollows: boolean;
  counts: ProfileCounts;
  favorites: GameSummary[];
  statusCounts: Record<PlayStatus, number>;
  histogram: number[];
  topGenres: { name: string; count: number }[];
  topPlatforms: { name: string; count: number }[];
  recentLogs: CheckpointView[];
  recentReviews: ReviewView[];
  currentlyPlaying: GameSummary[];
}

export interface LibraryItem {
  game: GameSummary;
  state: UserGameState;
  updatedAt: string;
}

/** Item da "fila" do usuário (jogando / quero jogar), com tempo médio para calcular progresso. */
export interface QueueItem {
  game: GameSummary & { avgHours: number | null };
  state: UserGameState;
  updatedAt: string;
}

export interface QueueData {
  playing: QueueItem[];
  backlog: QueueItem[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Uma linha do ranking geral (GET /ranking). */
export interface RankingEntry {
  position: number;
  game: GameSummary;
  /** Nota do ranking, de 0 a 1: avaliações da Steam pela fórmula do SteamDB (ver GamesService.ranking). */
  score: number;
  /** Avaliações da loja da Steam: % positivas (0–100) e total. */
  steam: { score: number; reviews: number };
  /** Nota da comunidade (1–10), só informativa: não entra na ordem. */
  community: { avg: number; count: number } | null;
}

export interface RankingData {
  items: RankingEntry[];
  method: {
    source: 'steam';
    /** Jogos do catálogo sem avaliações da Steam (ficam fora do ranking). */
    gamesWithoutSteam: number;
  };
}

export interface HomeData {
  trending: GameSummary[];
  recentReviews: ReviewView[];
  popularReviews: ReviewView[];
  lists: ListSummary[];
  friends: CheckpointView[];
  totals: { games: number; users: number; logs: number };
}

export interface ExternalGameResult {
  externalId: string;
  title: string;
  releaseYear: number | null;
  coverUrl: string | null;
  platforms: string[];
  /** Slug local quando o jogo já foi importado. */
  importedSlug: string | null;
}

export interface CatalogStatus {
  /** Fontes que importam jogos completos. */
  providers: { id: string; name: string; enabled: boolean }[];
  /** Fontes que só buscam capas/banners para jogos existentes. */
  artwork: { id: string; name: string; enabled: boolean }[];
}

export interface CatalogMeta {
  genres: Genre[];
  platforms: Platform[];
}

// ─── Steam ───────────────────────────────────────────────────────────────────

export interface SteamAccount {
  steamId: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  linkedAt: string;
  syncedAt: string | null;
}

export interface SteamLibraryItem {
  appId: string;
  name: string;
  /** Minutos jogados (total da conta). */
  minutes: number;
  /** Jogou nas últimas 2 semanas. */
  recent: boolean;
  lastPlayedAt: string | null;
  /** Imagem da loja, só para a prévia (não é salva). */
  imageUrl: string;
  /** Jogo correspondente no catálogo (pelo app id da Steam), se já existir. */
  game: GameSummary | null;
  /** Estado atual na estante do usuário, se o jogo já estiver lá. */
  entry: { status: PlayStatus | null; hoursPlayed: number | null } | null;
  /** Status sugerido para a importação (null = só as horas). */
  suggestedStatus: PlayStatus | null;
}

export interface SteamLibrary {
  account: SteamAccount;
  /** Perfil com "Detalhes do jogo" privado: a Steam não devolve a biblioteca. */
  private: boolean;
  items: SteamLibraryItem[];
}

export interface SteamImportResult {
  /** Jogos adicionados à estante. */
  added: number;
  /** Jogos que já estavam na estante (horas atualizadas). */
  updated: number;
  /** Jogos novos criados no catálogo a partir da loja da Steam. */
  createdGames: number;
  skipped: { appId: string; reason: string }[];
}
