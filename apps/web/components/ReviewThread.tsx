'use client';

import type { ReviewComment } from '@savepoint/shared';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { addCommentAction, deleteCommentAction, getCommentsAction } from '@/app/actions';
import { relativeTime } from '@/lib/format';
import { Avatar } from './bits';
import { Icon } from './Icon';

/**
 * Botão "respostas" + conversa da review. As respostas só são carregadas
 * quando a pessoa abre a conversa (não pesa nas listagens).
 */
export function ReviewThread({
  logId,
  initialCount,
  canReply,
  children,
}: {
  logId: string;
  initialCount: number;
  canReply: boolean;
  /** Itens do rodapé (curtir, data...) exibidos ao lado do botão. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<ReviewComment[] | null>(null);
  const [count, setCount] = useState(initialCount);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && comments === null) {
      start(async () => {
        const res = await getCommentsAction(logId);
        if (res.ok) {
          setComments(res.data);
          setCount(res.data.length);
        } else setError(res.error);
      });
    }
    if (next) setTimeout(() => input.current?.focus(), 50);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const res = await addCommentAction(logId, body);
      if (!res.ok) return setError(res.error);
      setComments((c) => [...(c ?? []), res.data]);
      setCount((n) => n + 1);
      setText('');
    });
  }

  function remove(id: string) {
    if (!confirm('Apagar esta resposta?')) return;
    start(async () => {
      const res = await deleteCommentAction(id);
      if (!res.ok) return setError(res.error);
      setComments((c) => (c ?? []).filter((x) => x.id !== id));
      setCount((n) => n - 1);
    });
  }

  const label = `${count} ${count === 1 ? 'resposta' : 'respostas'}`;

  return (
    <>
      <div className="review-foot">
        {children}
        <button
          type="button"
          className={`reply-btn ${open ? 'on' : ''}`}
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? 'Fechar respostas' : `Ver respostas (${label})`}
          title={label}
        >
          <Icon name="chat" size={16} /> <span>{count}</span>
        </button>
      </div>

      {open && (
        <div className="thread">
          {comments === null ? (
            <p className="muted thread-empty">Carregando…</p>
          ) : comments.length === 0 ? (
            <p className="muted thread-empty">Nenhuma resposta ainda.</p>
          ) : (
            <ul className="thread-list">
              {comments.map((c) => (
                <li key={c.id} className="thread-item">
                  <Link href={`/u/${c.user.username}`}>
                    <Avatar user={c.user} size={26} />
                  </Link>
                  <div>
                    <div className="thread-meta">
                      <Link href={`/u/${c.user.username}`}>{c.user.displayName}</Link>
                      <span>{relativeTime(c.createdAt)}</span>
                      {c.canDelete && (
                        <button type="button" className="thread-delete" onClick={() => remove(c.id)} aria-label="Apagar resposta">
                          <Icon name="trash" size={12} />
                        </button>
                      )}
                    </div>
                    <p className="thread-body">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && <div className="form-error">{error}</div>}

          {canReply ? (
            <form className="thread-form" onSubmit={submit}>
              <textarea
                ref={input}
                className="textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
                }}
                placeholder="Escreva uma resposta…"
                maxLength={2000}
                rows={2}
                aria-label="Sua resposta"
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !text.trim()}>
                {pending ? 'Enviando…' : 'Responder'}
              </button>
            </form>
          ) : (
            <p className="muted thread-empty">
              <Link href="/login" style={{ color: 'var(--accent)' }}>
                Entre
              </Link>{' '}
              para responder.
            </p>
          )}
        </div>
      )}
    </>
  );
}
