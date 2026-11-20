'use client';

import {
  PLAY_STATUS_LABEL,
  STEAM_IMPORT_BATCH,
  formatHours,
  type SteamImportResult,
  type SteamLibraryItem,
} from '@savepoint/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { importSteamAction, unlinkSteamAction } from '@/app/actions';

type Summary = SteamImportResult & { error: string | null };

/**
 * Sincroniza a biblioteca da Steam com a estante: todos os jogos entram, com as horas da Steam.
 * Roda sozinha logo após conectar a conta (`autoStart`) e em lotes, para caber no limite da função.
 * Status sugerido: nunca jogado → Quero jogar; jogado nas últimas 2 semanas → Jogando.
 * Status que o usuário já definiu nunca é sobrescrito (a API garante isso).
 */
export function SteamSync({
  items,
  username,
  autoStart,
}: {
  items: SteamLibraryItem[];
  username: string;
  autoStart: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [, startTransition] = useTransition();
  const started = useRef(false);

  const running = progress !== null && summary === null;
  const nameOf = useMemo(() => new Map(items.map((i) => [i.appId, i.name])), [items]);
  const pending = items.filter((i) => !i.entry).length;

  async function sync() {
    const queue = items.map((i) => ({ appId: i.appId, status: i.suggestedStatus }));
    const total: Summary = { added: 0, updated: 0, createdGames: 0, skipped: [], error: null };
    setSummary(null);
    setProgress({ done: 0, total: queue.length });

    for (let i = 0; i < queue.length; i += STEAM_IMPORT_BATCH) {
      const batch = queue.slice(i, i + STEAM_IMPORT_BATCH);
      const res = await importSteamAction(batch);
      if (!res.ok) {
        total.error = res.error;
        break;
      }
      total.added += res.data.added;
      total.updated += res.data.updated;
      total.createdGames += res.data.createdGames;
      total.skipped.push(...res.data.skipped);
      setProgress({ done: Math.min(i + batch.length, queue.length), total: queue.length });
    }
    setSummary(total);
    startTransition(() => router.refresh());
  }

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    // Tira o ?linked=1 da URL: recarregar a página não dispara outra importação.
    router.replace(pathname, { scroll: false });
    void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <section className="section steam-import">
      <div className="steam-footer">
        {running ? (
          <div className="steam-progress" role="status">
            <strong>Importando sua biblioteca…</strong>
            <div className="steam-bar">
              <span style={{ width: `${(progress!.done / progress!.total) * 100}%` }} />
            </div>
            <span className="mono">
              {progress!.done}/{progress!.total}
            </span>
            <span className="muted">Não feche esta página.</span>
          </div>
        ) : summary ? (
          <div className="steam-summary" role="status">
            {summary.error && <div className="form-error">{summary.error}</div>}
            <p>
              <strong>{summary.added}</strong> adicionados à estante · <strong>{summary.updated}</strong> atualizados ·{' '}
              <strong>{summary.createdGames}</strong> jogos novos no catálogo
            </p>
            {summary.skipped.length > 0 && (
              <details>
                <summary>{summary.skipped.length} não importados</summary>
                <ul>
                  {summary.skipped.map((s) => (
                    <li key={s.appId}>
                      {nameOf.get(s.appId) ?? s.appId}: <span className="muted">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="steam-actions">
              <Link href={`/u/${username}`} className="btn btn-primary">
                Ver minha estante
              </Link>
              {summary.error && (
                <button type="button" className="btn btn-ghost" onClick={sync}>
                  Tentar de novo
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <span className="muted">
              <strong className="mono">{items.length}</strong> jogos na Steam
              {pending > 0 && (
                <>
                  {' '}
                  · <strong className="mono">{pending}</strong> ainda fora da estante
                </>
              )}
            </span>
            <button type="button" className="btn btn-primary" onClick={sync}>
              Sincronizar de novo
            </button>
          </>
        )}
      </div>

      <ul className="steam-list">
        {items.map((item) => {
          const status = item.entry ? item.entry.status : item.suggestedStatus;
          return (
            <li key={item.appId} className="steam-row">
              <SteamCapsule appId={item.appId} src={item.imageUrl} />
              <div className="steam-info">
                <span className="steam-name">
                  {item.game ? <Link href={`/games/${item.game.slug}`}>{item.name}</Link> : item.name}
                </span>
                <span className="steam-meta">
                  <span className="mono">{item.minutes > 0 ? formatHours(item.minutes / 60) : 'nunca jogado'}</span>
                  {item.recent && <span className="steam-tag">jogando agora</span>}
                </span>
              </div>
              <span className={`steam-state${item.entry ? ' is-shelf' : ''}`}>
                {item.entry ? (status ? PLAY_STATUS_LABEL[status] : 'Na estante') : status ? PLAY_STATUS_LABEL[status] : 'Só horas'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Miniatura da loja. Jogos mais novos não têm a imagem no endereço antigo:
 * tenta o endereço novo e, se nada carregar, fica só o bloco neutro.
 */
function SteamCapsule({ appId, src }: { appId: string; src: string }) {
  const sources = [src, `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`];
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLImageElement>(null);
  // Se a imagem falhou antes da hidratação, o onError do React nunca dispara: confere ao montar.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setIndex((i) => i + 1);
  }, [index]);
  if (index >= sources.length) return <span className="steam-capsule" aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={sources[index]}
      alt=""
      loading="lazy"
      className="steam-capsule"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

export function SteamUnlinkButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={pending}
      onClick={() => {
        if (!confirm('Desconectar a conta Steam? Os jogos já importados continuam na sua estante.')) return;
        startTransition(async () => {
          await unlinkSteamAction();
          router.refresh();
        });
      }}
    >
      {pending ? 'Desconectando…' : 'Desconectar'}
    </button>
  );
}
