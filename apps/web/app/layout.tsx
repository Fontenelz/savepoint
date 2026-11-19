import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { getViewer } from '@/lib/session';
import './globals.css';

const space = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-space' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jet = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-jet' });

export const metadata: Metadata = {
  title: { default: 'Savepoint — seu diário de jogos', template: '%s · Savepoint' },
  description: 'Registre o que você jogou, avalie, monte listas e descubra jogos pelo que seus amigos estão jogando.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <html lang="pt-BR" className={`${space.variable} ${inter.variable} ${jet.variable}`}>
      <body>
        <SiteHeader viewer={viewer} />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
