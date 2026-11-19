'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="shell" style={{ padding: '100px 0', textAlign: 'center' }}>
      <p className="mono" style={{ color: 'var(--heart)', letterSpacing: '0.2em' }}>
        CONTINUE? 10… 9… 8…
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>
        Algo deu errado.
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        {error.message || 'Erro inesperado.'} Verifique se a API está rodando em <code>localhost:3333</code>.
      </p>
      <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={reset}>
        Tentar de novo
      </button>
    </div>
  );
}
