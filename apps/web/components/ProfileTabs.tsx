'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ProfileTabs({ username, counts }: { username: string; counts: { reviews: number; lists: number } }) {
  const path = usePathname();
  const base = `/u/${username}`;
  const tabs = [
    { href: base, label: 'Perfil' },
    { href: `${base}/games`, label: 'Jogos' },
    { href: `${base}/diary`, label: 'Diário' },
    { href: `${base}/reviews`, label: `Reviews · ${counts.reviews}` },
    { href: `${base}/lists`, label: `Listas · ${counts.lists}` },
  ];
  return (
    <nav className="tabs" aria-label="Seções do perfil">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? 'on' : ''} aria-current={path === t.href ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
