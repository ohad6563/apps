const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const PlayIcon = () => (
  <svg {...base}>
    <path d="M7 5v14l11-7z" fill="currentColor" stroke="none" />
  </svg>
);
export const PauseIcon = () => (
  <svg {...base}>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
  </svg>
);
export const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg {...base}>
    <path
      d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </svg>
);
export const MinusIcon = () => (
  <svg {...base}>
    <path d="M6 12h12" />
  </svg>
);
export const PlusIcon = () => (
  <svg {...base}>
    <path d="M12 6v12M6 12h12" />
  </svg>
);
export const BackIcon = () => (
  <svg {...base}>
    {/* ב-RTL "חזרה" מצביע ימינה */}
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const SearchIcon = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </svg>
);
