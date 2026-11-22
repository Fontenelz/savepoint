import type { SteamAccount, SteamLibrary } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { SteamSync, SteamUnlinkButton } from '@/components/SteamSync';
import { api, errorMessage } from '@/lib/api';
import { getViewer } from '@/lib/session';
import { STEAM_ERRORS, STEAM_PATH } from '@/lib/steam';

// Página pessoal: fora da busca.
export const metadata: Metadata = { title: 'Steam', robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ linked?: string; error?: string; bemvindo?: string }> };

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function SteamPage({ searchParams }: Props) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${STEAM_PATH}`);
  const sp = await searchParams;

  const [status, account] = await Promise.all([
    api<{ enabled: boolean }>('/steam/status'),
    api<SteamAccount | null>('/steam/account').then((a) => a ?? null),
  ]);

  let library: SteamLibrary | null = null;
  let libraryError: string | null = null;
  if (account) {
    try {
      library = await api<SteamLibrary>('/steam/library');
    } catch (e) {
      libraryError = errorMessage(e);
    }
  }

  const error = sp.error ? (STEAM_ERRORS[sp.error] ?? STEAM_ERRORS.failed) : null;
  const profilePath = `/u/${viewer.username}`;
  // Logo após criar a conta (cadastro ou Google): boas-vindas + opção de pular.
  const welcome = Boolean(sp.bemvindo) && !account;
  if (welcome && !status.enabled) redirect(profilePath);

  return (
    <div className="shell form-page steam-page">
      {welcome ? (
        <div className="page-head">
          <h1 className="page-title">Conta criada! Comece com a estante cheia</h1>
          <p>
            Conecte sua Steam e todos os seus jogos entram na estante com as horas jogadas. Se preferir, dá para fazer
            isso depois em <strong>Menu → Conectar Steam</strong>.
          </p>
        </div>
      ) : (
        <div className="page-head">
          <Link href="/settings" className="steam-back">
            Editar perfil
          </Link>
          <h1 className="page-title">Steam</h1>
          <p>Conecte sua conta para trazer sua biblioteca e suas horas de jogo para a estante.</p>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
      {sp.linked && account && (
        <div className="notice steam-ok">Conta conectada! Estamos trazendo sua biblioteca para a estante.</div>
      )}

      {!status.enabled && !account ? (
        <div className="notice">A integração com a Steam não está configurada neste servidor.</div>
      ) : !account ? (
        <section className="section steam-connect">
          <ul className="steam-points">
            <li>Você entra pelo site da própria Steam. Sua senha nunca passa pelo Savepoint.</li>
            <li>
              Todos os seus jogos entram na estante com as horas jogadas. Os nunca jogados vão para{' '}
              <strong>Quero jogar</strong> e os das últimas 2 semanas, para <strong>Jogando</strong>.
            </li>
            <li>Jogos que ainda não estão no catálogo são cadastrados com dados da loja da Steam.</li>
            <li>Status que você já marcou não são alterados.</li>
          </ul>
          {/* Link comum (não <Link>): a rota redireciona para fora do site. */}
          <div className="steam-connect-actions">
            <a href={`${STEAM_PATH}/connect`} className="btn btn-primary btn-lg">
              Conectar com a Steam
            </a>
            {welcome && (
              <Link href={profilePath} className="btn btn-ghost btn-lg">
                Pular por agora
              </Link>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="steam-account">
            {account.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatarUrl} alt="" width={56} height={56} className="steam-avatar" />
            )}
            <div className="steam-account-info">
              <strong>{account.name ?? 'Conta Steam'}</strong>
              <span className="muted">
                Conectada em {dateFmt.format(new Date(account.linkedAt))}
                {account.syncedAt && ` · última importação em ${dateFmt.format(new Date(account.syncedAt))}`}
              </span>
              <a href={account.profileUrl} target="_blank" rel="noreferrer" className="steam-profile-link">
                Ver perfil na Steam <Icon name="external" size={12} />
              </a>
            </div>
            <SteamUnlinkButton />
          </section>

          {libraryError ? (
            <div className="form-error">{libraryError}</div>
          ) : library?.private ? (
            <div className="notice">
              <strong>Sua biblioteca está privada.</strong> Na Steam, abra <em>Perfil → Editar perfil → Privacidade</em> e
              deixe <em>Detalhes do jogo</em> como <strong>Público</strong>. Depois, recarregue esta página.
            </div>
          ) : library && library.items.length === 0 ? (
            <div className="notice">Nenhum jogo encontrado na sua conta Steam.</div>
          ) : library ? (
            <SteamSync items={library.items} username={viewer.username} autoStart={Boolean(sp.linked)} />
          ) : null}
        </>
      )}
    </div>
  );
}
