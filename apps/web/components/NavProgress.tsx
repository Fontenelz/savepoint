'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** Só mostra a barra se a navegação passar disto (evita piscar em páginas que abrem na hora). */
const SHOW_DELAY_MS = 120;
/** Segurança: se a navegação não terminar (ex.: link para a mesma página), some depois disto. */
const MAX_MS = 20_000;

/**
 * Barra de progresso no topo durante a navegação.
 *
 * As páginas buscam os dados na API antes de renderizar, e o Next mantém a página antiga na tela
 * até a nova ficar pronta — sem isto, o clique parecia não ter funcionado. Começa no clique em link
 * interno (ou no envio de formulário GET, como a busca do cabeçalho) e termina quando o endereço muda.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const active = useRef(false);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Endereço mudou: a nova página chegou.
  useEffect(() => {
    if (!active.current) return;
    active.current = false;
    clear();
    document.documentElement.classList.remove('nav-pending');
    setPhase((p) => (p === 'loading' ? 'done' : 'idle'));
    timers.current.push(setTimeout(() => setPhase('idle'), 350));
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      clear();
      active.current = true;
      document.documentElement.classList.add('nav-pending');
      timers.current.push(
        setTimeout(() => active.current && setPhase('loading'), SHOW_DELAY_MS),
        setTimeout(() => {
          active.current = false;
          document.documentElement.classList.remove('nav-pending');
          setPhase('idle');
        }, MAX_MS),
      );
    };

    const sameAsCurrent = (url: URL) => url.pathname === location.pathname && url.search === location.search;

    // Fase de captura: o <Link> do Next chama preventDefault() para navegar no cliente, então na
    // fase normal todo clique de navegação já chegaria "prevenido".
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || !a.href || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || sameAsCurrent(url)) return; // externo, âncora ou mesma página
      start();
    };

    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      // Só formulários GET comuns (ex.: busca). Server Actions têm o próprio estado de "salvando".
      if (e.defaultPrevented || form.method.toLowerCase() !== 'get' || typeof form.getAttribute('action') !== 'string') return;
      start();
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit);
      clear();
    };
  }, []);

  return <div className={`nav-progress nav-progress--${phase}`} aria-hidden />;
}
