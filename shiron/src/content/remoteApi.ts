/**
 * ספק תוכן: API מורשה חיצוני (שותף תוכן / שרת פנימי עם רישיון).
 *
 * מופעל רק כשמוגדר משתנה הסביבה VITE_CHORDS_API_URL בזמן הבנייה.
 * החוזה המלא מתועד ב-docs/content-providers.md:
 *   GET {base}/sheets?recording={mbid}&work={mbid,...}&isrc={...}&title=...&artist=...
 *   → { "sheets": [ { "id", "title", "artist", "key"?, "capo"?, "chordpro", "source": { "name", "license", "url"? } } ] }
 */
import { parseSongText } from '../lib/parse';
import type { ChordProvider, ChordSheet, SongRef } from './types';

interface RemoteSheet {
  id: string;
  title: string;
  artist: string;
  key?: string;
  capo?: number;
  chordpro: string;
  source: { name: string; license: string; url?: string };
}

export function createRemoteProvider(
  baseUrl: string | undefined,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): ChordProvider {
  const base = baseUrl?.replace(/\/+$/, '');
  return {
    id: 'remote',
    name: 'ספק אקורדים מורשה',
    description: base
      ? `שרת תוכן מורשה בכתובת ${new URL(base).host}.`
      : 'לא מוגדר. כדי לחבר מאגר אקורדים מורשה מגדירים VITE_CHORDS_API_URL (ראו docs/content-providers.md).',
    isEnabled: () => Boolean(base),
    async find(ref: SongRef, signal?: AbortSignal): Promise<ChordSheet[]> {
      if (!base) return [];
      const params = new URLSearchParams({
        recording: ref.recordingId,
        title: ref.title,
        artist: ref.artist,
      });
      if (ref.workIds.length) params.set('work', ref.workIds.join(','));
      if (ref.isrcs.length) params.set('isrc', ref.isrcs.join(','));
      const res = await fetchImpl(`${base}/sheets?${params}`, { signal });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sheets?: RemoteSheet[] };
      return (data.sheets ?? [])
        .filter((s) => s && typeof s.chordpro === 'string' && s.source?.license)
        .map((s) => ({
          id: `remote:${s.id}`,
          title: s.title,
          artist: s.artist,
          key: s.key,
          capo: s.capo,
          sections: parseSongText(s.chordpro),
          source: { providerId: 'remote', name: s.source.name, license: s.source.license, url: s.source.url },
        }));
    },
  };
}

export const remoteProvider = createRemoteProvider(import.meta.env.VITE_CHORDS_API_URL as string | undefined);
