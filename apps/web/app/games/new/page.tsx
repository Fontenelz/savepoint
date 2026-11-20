import type { CatalogMeta, CatalogStatus } from '@savepoint/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ExternalImport, GameForm } from '@/components/forms';
import { api } from '@/lib/api';
import { getViewer } from '@/lib/session';

// Página pessoal: fora da busca.
export const metadata: Metadata = { title: 'Cadastrar jogo', robots: { index: false, follow: false } };

export default async function NewGamePage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/games/new');
  const [meta, catalog] = await Promise.all([api<CatalogMeta>('/meta'), api<CatalogStatus>('/catalog/status')]);
  const igdb = catalog.providers.find((p) => p.id === 'igdb');

  return (
    <div className="shell form-page">
      <div className="page-head">
        <h1 className="page-title">Cadastrar jogo</h1>
        <p>O catálogo é da comunidade: qualquer pessoa pode adicionar um jogo que ainda não existe.</p>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Importar de fonte externa</h2>
        </div>
        {igdb?.enabled ? (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              Busque no IGDB e importe com um clique. Os dados são <strong>copiados</strong> para o nosso banco — o app
              não depende do IGDB depois disso.
            </p>
            <ExternalImport />
          </>
        ) : (
          <div className="notice">
            Importação completa desativada (requer IGDB). Sem problema: cadastre manualmente abaixo e a capa e o
            banner são buscados automaticamente na Wikipedia e na Steam.
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Cadastro manual</h2>
        </div>
        <GameForm meta={meta} />
      </section>
    </div>
  );
}
