import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthArt } from '@/components/AuthArt';
import { RegisterForm } from '@/components/forms';
import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Criar conta', robots: { index: false, follow: true } };

export default async function RegisterPage() {
  if (await getViewer()) redirect('/');
  return (
    <div className="auth">
      <AuthArt quote="Seu backlog não vai se organizar sozinho." />
      <div className="auth-form">
        <RegisterForm />
      </div>
    </div>
  );
}
