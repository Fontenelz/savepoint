'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

/**
 * Em produção o Next troca a mensagem de erros de Server Components por um texto genérico em inglês
 * (com `digest`); só em desenvolvimento a mensagem original chega aqui.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const dev = process.env.NODE_ENV === 'development';
  // reset() só re-renderiza no cliente; refresh() busca a página de novo no servidor (onde o erro aconteceu).
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <div className="shell" style={{ padding: '100px 0', textAlign: 'center' }}>
      <p className="mono" style={{ color: 'var(--heart)', letterSpacing: '0.2em' }}>
        CONTINUE? 10… 9… 8…
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>
        Algo deu errado.
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        {dev ? (
          <>
            {error.message || 'Erro inesperado.'} Verifique se a API está rodando em <code>localhost:3333</code>.
          </>
        ) : (
          'Não conseguimos carregar esta página agora. Tente de novo em instantes.'
        )}
      </p>
      {error.digest && (
        <p className="mono muted" style={{ marginTop: 6, fontSize: 12 }}>
          código {error.digest}
        </p>
      )}
      <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={retry}>
        Tentar de novo
      </button>
    </div>
  );
}
