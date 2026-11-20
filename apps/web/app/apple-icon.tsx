import { ImageResponse } from 'next/og';
import { C } from '@/lib/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Ícone para a tela inicial do iPhone/iPad (mesmo desenho do icon.svg, sem transparência). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <svg width={150} height={150} viewBox="0 0 48 48">
          <path fill={C.text} d="M20.5 9H16a7.5 7.5 0 0 0 0 15h4.5v-5H16a2.5 2.5 0 0 1 0-5h4.5z" />
          <path fill={C.text} d="M30 24h2a7.5 7.5 0 0 1 0 15H9v-5h23a2.5 2.5 0 0 0 0-5h-2z" />
          <path fill={C.accent} d="M21.5 9H26v14h-4.5zM26 9h12l-3.5 4.5L38 18H26zM18.5 22.5h10.5l-5.25 6z" />
        </svg>
      </div>
    ),
    { ...size, headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800' } },
  );
}
