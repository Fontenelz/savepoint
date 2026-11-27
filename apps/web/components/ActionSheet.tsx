'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Folha de ações que sobe da parte de baixo da tela (estilo app): título, um cartão com as
 * opções e o botão "Concluído". Usa <dialog> modal: Esc fecha e o foco fica preso nela.
 * Tocar fora (no fundo desfocado) também fecha.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  sub,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Foco na própria folha, não no primeiro botão (que apareceria destacado ao abrir).
      d.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      tabIndex={-1}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-head">
        <strong id="sheet-title">{title}</strong>
        {sub && <span>{sub}</span>}
      </div>
      <div className="sheet-card">{children}</div>
      <button type="button" className="sheet-done" onClick={onClose}>
        Concluído
      </button>
    </dialog>
  );
}
