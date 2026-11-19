import type { Profile } from '@savepoint/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/forms';
import { api } from '@/lib/api';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Editar perfil' };

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/settings');
  const profile = await api<Profile>(`/users/${viewer.username}`);

  return (
    <div className="shell form-page">
      <div className="page-head">
        <h1 className="page-title">Editar perfil</h1>
        <p>
          Para escolher seu Top 4, abra a página de um jogo e toque em <strong>★ Top 4</strong>.
        </p>
      </div>
      <div className="section">
        <ProfileForm user={profile.user} />
      </div>
    </div>
  );
}
