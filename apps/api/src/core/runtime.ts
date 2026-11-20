import service from '../service.mjs';

/**
 * A ponte entre o app Nest e o serviço do Composer, lida uma vez por processo:
 * o cliente Prisma ORM 8 vem da dependência `db` declarada em `service.mts`
 * (nunca de DATABASE_URL) e a configuração do `input` do serviço.
 */
const { db: binding } = service.load();

/** O cliente Prisma ORM 8: consultas em `db.orm.public.<Model>`. */
export const db = binding.client;

const config = service.input();

/** Segredo que assina os tokens de sessão (JWT). */
export const jwtSecret: string = config.jwtSecret.expose();

/** Origem pública do site para o CORS; resolvida em deploy pelo Composer. */
export const webOrigin: string = config.webOrigin as string;

/** Credenciais do IGDB (Twitch), opcionais — sem elas o app usa só o catálogo local. */
export const igdbClientId: string = config.igdbClientId?.expose() ?? '';
export const igdbClientSecret: string = config.igdbClientSecret?.expose() ?? '';

/** Token do Vercel Blob, opcional — sem ele as imagens ficam no disco local. */
export const blobToken: string = config.blobToken?.expose() ?? '';
