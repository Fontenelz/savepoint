import type { PrismaService } from './prisma.service';

/** Mesmo limite do nome vindo do Google no cadastro. */
const MAX_NAME = 40;

/**
 * Foto e nome exibidos seguem as contas conectadas: **Steam primeiro, depois Google**.
 * - Foto (`avatarUrl`): avatar da Steam; sem Steam, a foto do Google; sem nenhuma, null (silhueta).
 * - Nome (`displayName`): nome da Steam; sem Steam, o do Google; sem nenhum, fica o que a pessoa definiu.
 *
 * Reaplicado sempre que uma conta é conectada, desconectada ou usada para entrar — por isso uma
 * edição manual do nome dura até o próximo login com Steam/Google (decisão do produto).
 */
export async function applyAccountProfile(prisma: PrismaService, userId: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { steamId: true, steamName: true, steamAvatar: true, googleId: true, googleName: true, googleAvatar: true },
  });
  if (!u) return;
  const clean = (s: string | null | undefined) => s?.trim().slice(0, MAX_NAME) || null;
  const steam = u.steamId ? { name: clean(u.steamName), avatar: u.steamAvatar } : null;
  const google = u.googleId ? { name: clean(u.googleName), avatar: u.googleAvatar } : null;

  const name = steam?.name ?? google?.name ?? null;
  await prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl: steam?.avatar ?? google?.avatar ?? null,
      ...(name ? { displayName: name } : {}),
    },
  });
}
