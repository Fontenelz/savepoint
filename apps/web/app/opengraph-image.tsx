import { C, GradientLine, Logo, OG_CACHE, OG_SIZE, ogImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Savepoint — seu diário de jogos';

/** Imagem padrão de compartilhamento (home e páginas sem imagem própria). Só a marca. */
export default function Image() {
  return ogImage(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.bg }}>
      <GradientLine />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', padding: '0 90px', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Logo size={112} />
          <div style={{ display: 'flex', fontSize: 104, fontWeight: 800, color: C.text, letterSpacing: -3 }}>savepoint</div>
        </div>
        <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: C.accent }}>Seu diário de jogos.</div>
        <div style={{ display: 'flex', fontSize: 30, color: C.text2, maxWidth: 900, lineHeight: 1.35 }}>
          Registre o que você jogou, avalie, monte listas e veja o que seus amigos estão jogando.
        </div>
      </div>
      <div style={{ display: 'flex', padding: '0 90px 48px', color: C.muted, fontSize: 24 }}>Projeto de portfólio</div>
    </div>,
    OG_CACHE.brand,
  );
}
