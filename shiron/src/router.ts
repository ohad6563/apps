import { useEffect, useState } from 'react';
import type { SearchMode } from './catalog/types';

export type Route =
  | { name: 'search'; q: string; mode: SearchMode }
  | { name: 'song'; id: string }
  | { name: 'artist'; id: string }
  | { name: 'sources' };

const MODES: SearchMode[] = ['all', 'song', 'artist', 'style'];

/** כתובות ייחודיות: #/song/<id>, #/artist/<id>, #/?q=...&mode=..., #/sources */
export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'song' && parts[1]) return { name: 'song', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'artist' && parts[1]) return { name: 'artist', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'sources') return { name: 'sources' };
  const params = new URLSearchParams(qs);
  const mode = params.get('mode') as SearchMode;
  return { name: 'search', q: params.get('q') ?? '', mode: MODES.includes(mode) ? mode : 'all' };
}

export function searchHref(q: string, mode: SearchMode): string {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (mode !== 'all') p.set('mode', mode);
  const s = p.toString();
  return '#/' + (s ? '?' + s : '');
}

export const songHref = (id: string) => `#/song/${id}`;
export const artistHref = (id: string) => `#/artist/${id}`;

/** מעדכן את הכתובת בלי ליצור רשומת היסטוריה (למשל בזמן הקלדה). */
export function replaceHash(href: string) {
  if (window.location.hash === href) return;
  history.replaceState(null, '', href);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/* עומק הניווט בתוך האתר: כך "חזרה" מחזירה לתוצאות החיפוש (עם הגלילה) כשאפשר. */
let depth = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', (e) => {
    if (e.isTrusted) depth++;
  });
}

export function backIfPossible(e: { preventDefault: () => void }) {
  if (depth > 0) {
    e.preventDefault();
    depth -= 2; // הקפיצה אחורה עצמה תיספר שוב כ-hashchange
    window.history.back();
  }
}
