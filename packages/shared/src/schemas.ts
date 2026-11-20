import { z } from 'zod';
import { GAME_SORTS, LIBRARY_FILTERS, PLAY_STATUSES } from './enums';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD');
/** Data que não pode estar no futuro (1 dia de folga por causa de fusos horários). */
const pastDate = dateString.refine((d) => {
  const limit = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return d <= limit;
}, 'A data não pode estar no futuro');
/** Nota interna de 1 a 10 (= 0,5 a 5 estrelas). */
const rating = z.number().int().min(1).max(10);

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, 'De 3 a 20 caracteres: letras, números e _'),
  displayName: z.string().trim().min(1, 'Informe seu nome').max(40),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres').max(72),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1, 'Informe usuário ou e-mail'),
  password: z.string().min(1, 'Informe a senha'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const libraryEntrySchema = z.object({
  status: z.enum(PLAY_STATUSES).nullable().optional(),
  rating: rating.nullable().optional(),
  liked: z.boolean().optional(),
  platformId: z.string().nullable().optional(),
  hoursPlayed: z.number().min(0).max(100000).nullable().optional(),
  startedAt: pastDate.nullable().optional(),
  finishedAt: pastDate.nullable().optional(),
});
export type LibraryEntryInput = z.infer<typeof libraryEntrySchema>;

export const logEntrySchema = z.object({
  gameId: z.string().min(1),
  playedOn: pastDate,
  platformId: z.string().nullable().optional(),
  hours: z.number().min(0).max(100000).nullable().optional(),
  finished: z.boolean().default(false),
  replay: z.boolean().default(false),
  rating: rating.nullable().optional(),
  liked: z.boolean().default(false),
  review: z.string().trim().max(8000).nullable().optional(),
  spoiler: z.boolean().default(false),
});
export type LogEntryInput = z.input<typeof logEntrySchema>;

export const listSchema = z.object({
  title: z.string().trim().min(1, 'Dê um nome à lista').max(80),
  description: z.string().trim().max(1000).nullable().optional(),
  ranked: z.boolean().default(false),
  gameIds: z.array(z.string()).max(200).default([]),
});
export type ListInput = z.input<typeof listSchema>;

export const listAddItemSchema = z.object({ gameId: z.string().min(1) });

export const createGameSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(120),
  releaseYear: z.number().int().min(1950).max(2100).nullable().optional(),
  developer: z.string().trim().max(120).nullable().optional(),
  publisher: z.string().trim().max(120).nullable().optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  avgHours: z.number().min(0).max(10000).nullable().optional(),
  coverUrl: z.string().url('URL inválida').nullable().optional(),
  genreIds: z.array(z.string()).max(10).default([]),
  platformIds: z.array(z.string()).max(20).default([]),
});
export type CreateGameInput = z.input<typeof createGameSchema>;

export const gameQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  genre: z.string().optional(),
  platform: z.string().optional(),
  year: z.coerce.number().int().optional(),
  sort: z.enum(GAME_SORTS).default('popular'),
  page: z.coerce.number().int().min(1).default(1),
});
export type GameQuery = z.infer<typeof gameQuerySchema>;

export const libraryQuerySchema = z.object({
  filter: z.enum(LIBRARY_FILTERS).default('all'),
  page: z.coerce.number().int().min(1).default(1),
});
export type LibraryQuery = z.infer<typeof libraryQuerySchema>;

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const catalogSearchSchema = z.object({ q: z.string().trim().min(2).max(100) });
export const catalogImportSchema = z.object({ externalId: z.string().min(1) });

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(300).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Escreva alguma coisa').max(2000),
});
export type CommentInput = z.infer<typeof commentSchema>;

export const gameIdsQuerySchema = z.object({
  ids: z
    .string()
    .transform((v) => v.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.string()).max(100)),
});
