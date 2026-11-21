import type { ArtistSummary, SongSummary } from '../catalog/types';
import { hasKnownSheet } from '../content/registry';
import { artistHref, songHref } from '../router';
import { useFavorites } from '../lib/storage';
import { HeartIcon } from './Icons';

export function formatLength(ms?: number): string | undefined {
  if (!ms) return undefined;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const TYPE_LABEL: Record<string, string> = {
  Person: 'זמר/ת',
  Group: 'להקה',
  Orchestra: 'תזמורת',
  Choir: 'מקהלה',
  Character: 'דמות',
};

export function SongList({ songs, hideArtist = false }: { songs: SongSummary[]; hideArtist?: boolean }) {
  const { isFavorite } = useFavorites();
  return (
    <ul className="song-list">
      {songs.map((s) => {
        const chords = hasKnownSheet({ recordingId: s.id, title: s.title, artist: s.artist });
        const meta = [s.year, formatLength(s.lengthMs)].filter(Boolean).join(' · ');
        return (
          <li key={s.id}>
            <a href={songHref(s.id)} className="song-item">
              <span className="song-item-text">
                <bdi className="song-item-title">{s.title}</bdi>
                <span className="song-item-artist">
                  {!hideArtist && <bdi>{s.artist}</bdi>}
                  {!hideArtist && meta && ' · '}
                  {meta && <span dir="ltr">{meta}</span>}
                  {s.disambiguation && <span className="muted"> ({s.disambiguation})</span>}
                </span>
                {s.tags.length > 0 && (
                  <span className="tags">
                    {s.tags.slice(0, 3).map((t) => (
                      <span className="tag" key={t} dir="auto">
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="song-item-side">
                {isFavorite(s.id) && (
                  <span className="fav-mark" aria-label="במועדפים">
                    <HeartIcon filled />
                  </span>
                )}
                {chords && <span className="badge badge--chords">אקורדים</span>}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function ArtistList({ artists, compact = false }: { artists: ArtistSummary[]; compact?: boolean }) {
  return (
    <ul className={'artist-list' + (compact ? ' artist-list--compact' : '')}>
      {artists.map((a) => {
        const extra = [a.type && TYPE_LABEL[a.type], a.country].filter(Boolean).join(' · ');
        return (
          <li key={a.id}>
            <a href={artistHref(a.id)} className="artist-item">
              <span className="artist-avatar" aria-hidden>
                {a.name.trim().charAt(0)}
              </span>
              <span className="song-item-text">
                <bdi className="song-item-title">{a.name}</bdi>
                <span className="song-item-artist">
                  {extra}
                  {a.disambiguation && (
                    <>
                      {extra && ' · '}
                      <bdi>{a.disambiguation}</bdi>
                    </>
                  )}
                </span>
                {!compact && a.aliases.length > 0 && (
                  <span className="muted aliases">
                    שמות נוספים: <bdi>{a.aliases.slice(0, 4).join(', ')}</bdi>
                  </span>
                )}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
