import type { Viewer } from '@savepoint/shared';
import Link from 'next/link';
import { logoutAction } from '@/app/actions';
import { Avatar } from './bits';
import { Icon } from './Icon';

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Savepoint — início">
      <span className="logo-mark" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      savepoint
    </Link>
  );
}

export function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  return (
    <header className="site-header">
      <div className="shell">
        <Logo />
        <nav className="nav" aria-label="Principal">
          <Link href="/games">Jogos</Link>
          <Link href="/lists">Listas</Link>
          {viewer && <Link href="/activity">Atividade</Link>}
        </nav>
        <form action="/games" className="header-search" role="search">
          <Icon name="search" size={14} />
          <input name="q" placeholder="Buscar jogos…" aria-label="Buscar jogos" />
        </form>
        <div className="header-user">
          {viewer ? (
            <details className="menu">
              <summary>
                <Avatar user={viewer} size={30} />
                <span className="hide-sm">{viewer.displayName.split(' ')[0]}</span>
              </summary>
              <div className="menu-panel">
                <Link href={`/u/${viewer.username}`}>Perfil</Link>
                <Link href={`/u/${viewer.username}/diary`}>Diário</Link>
                <Link href={`/u/${viewer.username}/games?filter=BACKLOG`}>Backlog</Link>
                <Link href={`/u/${viewer.username}/lists`}>Minhas listas</Link>
                <hr />
                <Link href="/lists/new">Nova lista</Link>
                <Link href="/games/new">Cadastrar jogo</Link>
                <Link href="/settings">Editar perfil</Link>
                <hr />
                <form action={logoutAction}>
                  <button type="submit">Sair</button>
                </form>
              </div>
            </details>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Entrar
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <span>
          <strong style={{ color: 'var(--text-2)' }}>savepoint</strong> — seu diário de jogos. Projeto de portfólio.
        </span>
        <nav>
          <Link href="/games">Catálogo</Link>
          <Link href="/lists">Listas</Link>
          <Link href="/games/new">Cadastrar jogo</Link>
        </nav>
      </div>
    </footer>
  );
}
