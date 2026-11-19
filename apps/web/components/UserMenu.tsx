'use client';

import type { Viewer } from '@savepoint/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { logoutAction } from '@/app/actions';
import { Avatar } from './bits';

/**
 * Menu do usuário no cabeçalho. Controlado pelo React (em vez de <details> nativo):
 * fecha ao clicar/tocar fora, com Esc e ao navegar para outra página — e o estado
 * nunca diverge do HTML do servidor (o que causava erro de hidratação).
 */
export function UserMenu({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const panelId = useId();

  // Fecha ao trocar de página
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const base = `/u/${viewer.username}`;

  return (
    <div className={`menu ${open ? 'open' : ''}`} ref={root}>
      <button
        ref={trigger}
        type="button"
        className="menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar user={viewer} size={30} />
        <span className="hide-sm">{viewer.displayName.split(' ')[0]}</span>
      </button>
      {open && (
        <div className="menu-panel" id={panelId} role="menu" onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}>
          <Link href={base} role="menuitem">Perfil</Link>
          <Link href={`${base}/diary`} role="menuitem">Diário</Link>
          <Link href={`${base}/games?filter=BACKLOG`} role="menuitem">Backlog</Link>
          <Link href={`${base}/lists`} role="menuitem">Minhas listas</Link>
          <hr />
          <Link href="/lists/new" role="menuitem">Nova lista</Link>
          <Link href="/games/new" role="menuitem">Cadastrar jogo</Link>
          <Link href="/settings" role="menuitem">Editar perfil</Link>
          <hr />
          <form action={logoutAction}>
            <button type="submit" role="menuitem">
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
