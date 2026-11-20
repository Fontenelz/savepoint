import type { PlayStatus } from '@savepoint/shared';

const PATHS = {
  heart: 'M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  check: 'M4 12.5l5 5L20 6.5',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9.5 17h5',
  x: 'M6 6l12 12M18 6L6 18',
  infinity: 'M8 9a3 3 0 1 0 0 6c2 0 3-1.5 4-3s2-3 4-3a3 3 0 1 1 0 6c-2 0-3-1.5-4-3s-2-3-4-3z',
  plus: 'M12 5v14M5 12h14',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  replay: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
  text: 'M5 6h14M5 10h14M5 14h10M5 18h6',
  gamepad:
    'M7 8h10a5 5 0 0 1 4.9 6l-.4 2a2.5 2.5 0 0 1-4.4 1L15.5 15h-7L6.9 17a2.5 2.5 0 0 1-4.4-1l-.4-2A5 5 0 0 1 7 8zM8 10.5v3M6.5 12h3M15.5 11.5h.01M17.5 12.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  download: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  chat: 'M4 5h16v11H9l-5 4z',
  share: 'M12 15V3M7.5 7.5L12 3l4.5 4.5M8 11H5v10h14V11h-3',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  fill = false,
  className,
}: {
  name: IconName;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={fill ? 1.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export const STATUS_ICON: Record<PlayStatus, IconName> = {
  BACKLOG: 'bookmark',
  PLAYING: 'play',
  PAUSED: 'pause',
  COMPLETED: 'check',
  MASTERED: 'trophy',
  DROPPED: 'x',
  ENDLESS: 'infinity',
};

export const STATUS_COLOR: Record<PlayStatus, string> = {
  BACKLOG: 'var(--st-backlog)',
  PLAYING: 'var(--st-playing)',
  PAUSED: 'var(--st-paused)',
  COMPLETED: 'var(--st-completed)',
  MASTERED: 'var(--st-mastered)',
  DROPPED: 'var(--st-dropped)',
  ENDLESS: 'var(--st-endless)',
};
