import type { Viewer } from '@savepoint/shared';
import Link from 'next/link';
import { Icon } from './Icon';
import { UserMenu } from './UserMenu';

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
            <UserMenu viewer={viewer} />
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
          {' '}
          <span className="footer-credits">
            Dados de jogos:{' '}
            <a href="https://rawg.io" target="_blank" rel="noreferrer">
              RAWG
            </a>
            , IGDB e Steam.
          </span>
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
