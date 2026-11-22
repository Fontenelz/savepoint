import Link from 'next/link';
import { Avatar } from '@/components/bits';
import { FollowButton } from '@/components/FollowButton';
import { Icon } from '@/components/Icon';
import { ProfileTabs } from '@/components/ProfileTabs';
import { getProfile } from '@/lib/profile';
import { getViewer } from '@/lib/session';

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [profile, viewer] = await Promise.all([getProfile(username), getViewer()]);
  const { user, counts } = profile;
  const base = `/u/${user.username}`;

  return (
    <div className="shell">
      <header className="profile-head">
        <Avatar user={user} size={84} />
        <div className="profile-id">
          <h1>
            {user.displayName} <span className="handle">@{user.username}</span>
            {profile.isMe ? (
              <Link href="/settings" className="btn btn-sm">
                Editar perfil
              </Link>
            ) : viewer ? (
              <FollowButton username={user.username} initial={profile.viewerFollows} />
            ) : null}
          </h1>
          {user.bio && <p>{user.bio}</p>}
          {user.steam ? (
            <a href={user.steam.profileUrl} target="_blank" rel="noreferrer" className="steam-badge" title="Perfil na Steam">
              <Icon name="gamepad" size={13} />
              Steam{user.steam.name && <span>· {user.steam.name}</span>}
              <Icon name="external" size={11} />
            </a>
          ) : profile.isMe ? (
            <Link href="/settings/steam" className="steam-badge steam-badge--cta">
              <Icon name="gamepad" size={13} /> Conectar Steam
            </Link>
          ) : null}
        </div>
        <div className="hud">
          <Link href={`${base}/games?filter=played`}>
            <b>{counts.played}</b>
            <span>Jogados</span>
          </Link>
          <Link href={`${base}/diary`}>
            <b>{counts.thisYear}</b>
            <span>Este ano</span>
          </Link>
          <div>
            <b>{counts.hours.toLocaleString('pt-BR')}</b>
            <span>Horas</span>
          </div>
          <div>
            <b>{counts.followers}</b>
            <span>Seguidores</span>
          </div>
          <div>
            <b>{counts.following}</b>
            <span>Seguindo</span>
          </div>
        </div>
      </header>
      <ProfileTabs username={user.username} counts={counts} />
      {children}
    </div>
  );
}
