'use client';

import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { OPEN_SHEET_EVENT } from './GameActions';

/**
 * Botões sobre o banner da página do jogo, só no celular: voltar (‹) e mais opções (⋯),
 * que abre a folha de ações do painel.
 */
export function GameTopBar() {
  const router = useRouter();

  function back() {
    // Veio de outra página do site: volta para ela. Link direto (ex.: do WhatsApp): vai ao catálogo.
    const sameSite = document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (sameSite && window.history.length > 1) router.back();
    else router.push('/games');
  }

  return (
    <div className="game-topbar">
      <button type="button" className="game-topbar-btn" onClick={back} aria-label="Voltar">
        <Icon name="back" size={22} />
      </button>
      <button
        type="button"
        className="game-topbar-btn"
        onClick={() => window.dispatchEvent(new Event(OPEN_SHEET_EVENT))}
        aria-label="Mais opções"
      >
        <Icon name="more" size={24} />
      </button>
    </div>
  );
}
