import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="shell" style={{ padding: '100px 0', textAlign: 'center' }}>
      <p className="mono" style={{ color: 'var(--accent)', letterSpacing: '0.2em' }}>
        GAME OVER · 404
      </p>
      <h1 className="page-title" style={{ marginTop: 12 }}>
        Essa fase não existe.
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        Talvez o link esteja errado, ou o conteúdo tenha sido removido.
      </p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 24 }}>
        Voltar ao último save
      </Link>
    </div>
  );
}
