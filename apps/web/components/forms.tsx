'use client';

import type { CatalogMeta, ExternalGameResult, UserSummary } from '@savepoint/shared';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';
import {
  createGameAction,
  importExternalAction,
  loginAction,
  registerAction,
  searchExternalAction,
  updateProfileAction,
  type FormState,
} from '@/app/actions';
import { GameCover } from './GameCover';
import { Icon } from './Icon';

const initial: FormState = { error: null };

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
      {pending ? 'Aguarde…' : children}
    </button>
  );
}

/** Link comum (não <Link>): a rota redireciona para o Google. */
function GoogleButton({ next, divider = 'ou com usuário e senha' }: { next?: string; divider?: string }) {
  const href = next ? `/auth/google?next=${encodeURIComponent(next)}` : '/auth/google';
  return (
    <>
      <a href={href} className="btn btn-lg btn-block btn-google">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
        </svg>
        Continuar com Google
      </a>
      <div className="auth-divider">
        <span>{divider}</span>
      </div>
    </>
  );
}

export function LoginForm({ next, error }: { next?: string; error?: string | null }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action}>
      <h1>Continue de onde parou.</h1>
      <div className="demo-box">
        Só quer explorar? Entre com <code>demo</code> / <code>savepoint123</code>
      </div>
      {(state.error ?? error) && <div className="form-error">{state.error ?? error}</div>}
      <GoogleButton next={next} />
      <input type="hidden" name="next" value={next ?? ''} />
      <label className="field">
        <span>Usuário ou e-mail</span>
        <input className="input" name="login" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span>Senha</span>
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </label>
      <Submit pending={pending}>Entrar</Submit>
      <p className="alt">
        Novo por aqui? <Link href="/register">Crie sua conta</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <form action={action}>
      <h1>Crie seu save.</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Registre o que jogou, avalie, monte listas e veja o que seus amigos estão jogando.
      </p>
      {state.error && <div className="form-error">{state.error}</div>}
      <GoogleButton divider="ou crie com e-mail e senha" />
      <label className="field">
        <span>Nome</span>
        <input className="input" name="displayName" required maxLength={40} autoFocus />
      </label>
      <label className="field">
        <span>Usuário</span>
        <input className="input" name="username" required pattern="[a-zA-Z0-9_]{3,20}" title="3 a 20 letras, números ou _" />
      </label>
      <label className="field">
        <span>E-mail</span>
        <input className="input" name="email" type="email" required autoComplete="email" />
      </label>
      <label className="field">
        <span>Senha</span>
        <input className="input" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </label>
      <Submit pending={pending}>Criar conta</Submit>
      <p className="alt">
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </form>
  );
}

export function ProfileForm({ user }: { user: UserSummary & { bio: string | null } }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  return (
    <form action={action} style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
      {state.error && <div className="form-error">{state.error}</div>}
      <label className="field">
        <span>Nome de exibição</span>
        <input className="input" name="displayName" defaultValue={user.displayName} required maxLength={40} />
      </label>
      <label className="field">
        <span>Bio</span>
        <textarea className="textarea" name="bio" defaultValue={user.bio ?? ''} maxLength={300} style={{ minHeight: 90 }} />
      </label>
      <div>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </div>
    </form>
  );
}

/** Cadastro colaborativo de jogo (o catálogo cresce sem depender de API externa). */
export function GameForm({ meta }: { meta: CatalogMeta }) {
  const [state, action, pending] = useActionState(createGameAction, initial);
  return (
    <form action={action} className="form-grid">
      {state.error && <div className="form-error full">{state.error}</div>}
      <label className="field full">
        <span>Título *</span>
        <input className="input" name="title" required maxLength={120} />
      </label>
      <label className="field">
        <span>Ano de lançamento</span>
        <input className="input" name="releaseYear" type="number" min={1950} max={2100} />
      </label>
      <label className="field">
        <span>Tempo médio para zerar (h)</span>
        <input className="input" name="avgHours" type="number" min={0} step="0.5" />
      </label>
      <label className="field">
        <span>Desenvolvedora</span>
        <input className="input" name="developer" maxLength={120} />
      </label>
      <label className="field">
        <span>Publicadora</span>
        <input className="input" name="publisher" maxLength={120} />
      </label>
      <label className="field full">
        <span>Sinopse</span>
        <textarea className="textarea" name="summary" maxLength={2000} />
      </label>
      <label className="field full">
        <span>URL da capa (opcional — sem ela geramos uma capa)</span>
        <input className="input" name="coverUrl" type="url" placeholder="https://…" />
      </label>
      <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
        <span className="label">Gêneros</span>
        <div className="check-grid">
          {meta.genres.map((g) => (
            <label key={g.id} className="check-chip">
              <input type="checkbox" name="genreIds" value={g.id} />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
        <span className="label">Plataformas</span>
        <div className="check-grid">
          {meta.platforms.map((p) => (
            <label key={p.id} className="check-chip">
              <input type="checkbox" name="platformIds" value={p.id} />
              <span>{p.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="full">
        <button className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? 'Cadastrando…' : 'Cadastrar jogo'}
        </button>
      </div>
    </form>
  );
}

/** Busca/importação de uma fonte externa opcional (IGDB). */
export function ExternalImport() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ExternalGameResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <form
        style={{ display: 'flex', gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length < 2) return;
          setError(null);
          start(async () => {
            const res = await searchExternalAction(q);
            if (res.ok) setResults(res.data);
            else setError(res.error);
          });
        }}
      >
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Pizza Tower" />
        <button className="btn" disabled={pending}>
          <Icon name="search" size={14} /> Buscar
        </button>
      </form>
      {error && (
        <div className="form-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {results && results.length === 0 && <p className="muted" style={{ marginTop: 12 }}>Nada encontrado.</p>}
      {results && results.length > 0 && (
        <div className="ext-results">
          {results.map((r) => (
            <div key={r.externalId} className="ext-card">
              <GameCover game={{ slug: `ext-${r.externalId}`, title: r.title, coverUrl: r.coverUrl, releaseYear: r.releaseYear, platforms: r.platforms }} />
              <b>{r.title}</b>
              <span className="muted">{r.releaseYear ?? '—'}</span>
              {r.importedSlug ? (
                <Link href={`/games/${r.importedSlug}`} className="btn btn-sm">
                  Já no catálogo
                </Link>
              ) : (
                <button
                  className="btn btn-sm btn-primary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await importExternalAction(r.externalId);
                      if (res && !res.ok) setError(res.error);
                    })
                  }
                >
                  <Icon name="download" size={13} /> Importar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
