import { PLAY_STATUS_LABEL, ratingToStars, type ReviewView } from '@savepoint/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Review } from '@/components/Review';
import { ShareButton } from '@/components/ShareButton';
import { StoryButton } from '@/components/StoryButton';
import { apiOrNotFound } from '@/lib/api';
import { reviewPath } from '@/lib/format';
import { getViewer } from '@/lib/session';
import { metaDescription, publicPageMeta } from '@/lib/site';

type Props = { params: Promise<{ username: string; id: string }> };

/** Mesma review para os metadados e para a página, numa só ida à API. */
const getReview = cache((id: string) => apiOrNotFound<ReviewView>(`/saves/${encodeURIComponent(id)}`));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await getReview(id);
  const game = r.game.releaseYear ? `${r.game.title} (${r.game.releaseYear})` : r.game.title;
  const save = r.save.number > 1 ? ` · Save ${r.save.number}` : '';
  const stars = ratingToStars(r.rating);
  // Spoiler: o texto não vai para a prévia (WhatsApp, X, Discord mostram a descrição).
  const body = r.spoiler ? 'Review com spoilers — abra para ler.' : (r.review ?? '');
  const path = reviewPath(r);
  return publicPageMeta({
    title: `Review de ${game} por ${r.user.displayName}${save}`,
    // Prévia no estilo Letterboxd: "Review ★★★★ de Jogo (ano)", e o texto da review embaixo.
    shareTitle: `Review ${stars ? `${stars} ` : ''}de ${game}`,
    description: metaDescription(`${r.user.displayName} · ${PLAY_STATUS_LABEL[r.save.status]}${save}${body ? ` — ${body}` : ''}`),
    path,
    type: 'article',
    image: { url: `${path}/og`, alt: `Review de ${r.game.title}` },
  });
}

export default async function ReviewPage({ params }: Props) {
  const { username, id } = await params;
  const [review, viewer] = await Promise.all([getReview(id), getViewer()]);
  // A review precisa ser de quem está na URL (o layout do perfil já carrega essa pessoa).
  if (review.user.username !== username) notFound();

  return (
    <section className="section" style={{ maxWidth: 780 }}>
      <Review log={review} canLike={Boolean(viewer)} />
      <p className="muted" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <ShareButton path={reviewPath(review)} title={`Review de ${review.game.title} por ${review.user.displayName}`} />
        <StoryButton path={`${reviewPath(review)}/story`} fileName={`savepoint-${review.game.slug}.png`} />
        <span>
        <Link href={`/u/${review.user.username}/reviews`}>Todas as reviews de {review.user.displayName}</Link>
        {' · '}
        <Link href={`/games/${review.game.slug}`}>Página de {review.game.title}</Link>
        </span>
      </p>
    </section>
  );
}
