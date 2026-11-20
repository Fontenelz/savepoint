import 'server-only';

/** Cookie com o `state` da conexão com a Steam (protege contra vincular a conta de outra pessoa). */
export const STEAM_STATE_COOKIE = 'sp_steam_state';
export const STEAM_PATH = '/settings/steam';

export const steamCallbackUrl = (origin: string, state: string) =>
  `${origin}${STEAM_PATH}/callback?state=${encodeURIComponent(state)}`;

/** Códigos de erro do retorno da Steam → mensagem exibida na página. */
export const STEAM_ERRORS: Record<string, string> = {
  cancelled: 'Conexão cancelada na Steam.',
  state: 'A conexão expirou ou não foi iniciada aqui. Tente de novo.',
  taken: 'Essa conta Steam já está conectada a outro usuário do Savepoint.',
  failed: 'Não foi possível confirmar o login com a Steam. Tente de novo.',
};
