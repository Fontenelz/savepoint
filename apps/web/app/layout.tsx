import type { Metadata } from 'next';
import { Big_Shoulders, Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { getViewer } from '@/lib/session';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

// Títulos: Bricolage Grotesque (tamanho óptico: mais expressiva quanto maior o texto).
// Para voltar à anterior: Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display-src' })
const display = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-display-src' });
// Capas geradas: Big Shoulders, condensada, com cara de caixa de jogo.
const cover = Big_Shoulders({ subsets: ['latin'], axes: ['opsz'], variable: '--font-cover-src' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jet = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-jet' });

export const metadata: Metadata = {
  // Base para URLs absolutas de canonical, og:image e sitemap (ver lib/site.ts: SITE_URL).
  metadataBase: new URL(SITE_URL),
  title: { default: 'Savepoint — seu diário de jogos', template: '%s · Savepoint' },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Sem canonical/og:url aqui: o Next herda o layout em toda página que não define os seus,
  // e todas passariam a apontar para a home. Cada página pública define os próprios.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'pt_BR',
    title: 'Savepoint — seu diário de jogos',
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <html lang="pt-BR" className={`${display.variable} ${cover.variable} ${inter.variable} ${jet.variable}`}>
      <body>
        <SiteHeader viewer={viewer} />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
