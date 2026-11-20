import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthArt } from '@/components/AuthArt';
import { LoginForm } from '@/components/forms';
import { GOOGLE_ERRORS } from '@/lib/auth';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (await getViewer()) redirect('/');
  const { next, error } = await searchParams;
  return (
    <div className="auth">
      <AuthArt quote="“Só mais uma partida” — você, há 4 horas." />
      <div className="auth-form">
        <LoginForm next={next} error={error ? (GOOGLE_ERRORS[error] ?? GOOGLE_ERRORS.google_failed) : null} />
      </div>
    </div>
  );
}
