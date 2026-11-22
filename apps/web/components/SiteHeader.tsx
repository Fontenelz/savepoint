import type { Viewer } from '@savepoint/shared';
import Link from 'next/link';
import { Icon } from './Icon';
import { QuickLog } from './QuickLog';
import { UserMenu } from './UserMenu';

/** Bandeira de checkpoint: o "ponto de save" do nome. */
export function LogoFlag({ size = 22 }: { size?: number }) {
  return (
    <svg className="logo-flag" width={(size * 22) / 28} height={size} viewBox="0 0 22 28" aria-hidden>
      <path fill="currentColor" d="M2 1h3.5v20H2zM6.5 1H21l-4 6 4 6H6.5zM3.75 20.5l3 3-3 3-3-3z" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Savepoint — início">
      <LogoFlag />
      Savepoint
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
          <Link href="/ranking">Ranking</Link>
          <Link href="/lists">Listas</Link>
          {viewer && <Link href="/activity">Atividade</Link>}
        </nav>
        <form action="/games" className="header-search" role="search">
          <Icon name="search" size={14} />
          <input name="q" placeholder="Buscar jogos…" aria-label="Buscar jogos" />
        </form>
        <div className="header-user">
          {viewer ? (
            <>
              <QuickLog />
              <UserMenu viewer={viewer} />
            </>
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
