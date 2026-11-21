import { useEffect, useRef, useState } from 'react';
import { catalog, isAbort } from '../catalog/musicbrainz';
import { mergeSongs, STYLES } from '../catalog/query';
import { errorMessage, type ArtistSummary, type SearchMode, type SongSummary } from '../catalog/types';
import { listUserSheets } from '../content/userSheets';
import { replaceHash, searchHref, songHref } from '../router';
import { useFavorites } from '../lib/storage';
import { SearchIcon } from './Icons';
import { ArtistList, SongList } from './Results';

const DEBOUNCE_MS = 450;

const MODE_LABEL: Record<SearchMode, string> = {
  all: 'הכל',
  song: 'שם שיר',
  artist: 'אמן',
  style: 'סגנון',
};

const PLACEHOLDER: Record<SearchMode, string> = {
  all: 'שיר, אמן או שניהם: "אריק איינשטיין", "Hotel California"',
  song: 'שם השיר',
  artist: 'שם האמן, בעברית או באנגלית',
  style: 'סגנון, למשל רוק או jazz',
};

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'done';
      songs: SongSummary[];
      artists: ArtistSummary[];
      total: number;
      nextOffset: number | null;
      loadingMore: boolean;
      moreError?: string;
    };

export function SearchPage({ initialQ, mode }: { initialQ: string; mode: SearchMode }) {
  const [input, setInput] = useState(initialQ);
  const [query, setQuery] = useState(initialQ.trim());
  const [state, setState] = useState<State>({ status: 'idle' });
  const [retry, setRetry] = useState(0);
  const moreCtl = useRef<AbortController | null>(null);

  // הכתובת השתנתה מבחוץ (חזרה אחורה, קישור לסגנון)
  useEffect(() => {
    setInput((prev) => (prev.trim() === initialQ.trim() ? prev : initialQ));
    setQuery(initialQ.trim());
  }, [initialQ]);

  // debounce: מחפשים רק כשהמשתמש עוצר להקליד
  useEffect(() => {
    const t = setTimeout(() => {
      const q = input.trim();
      setQuery(q);
      replaceHash(searchHref(q, mode));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input, mode]);

  useEffect(() => {
    moreCtl.current?.abort();
    if (query.length < 2) {
      setState({ status: 'idle' });
      return;
    }
    const ctl = new AbortController();
    setState({ status: 'loading' });
    const run = async () => {
      try {
        if (mode === 'artist') {
          const page = await catalog.searchArtists(query, 0, ctl.signal);
          setState({
            status: 'done',
            songs: [],
            artists: page.items,
            total: page.total,
            nextOffset: page.nextOffset,
            loadingMore: false,
          });
        } else {
          const r = await catalog.searchSongs(query, mode, 0, ctl.signal);
          setState({
            status: 'done',
            songs: r.songs.items,
            artists: r.artists,
            total: r.songs.total,
            nextOffset: r.songs.nextOffset,
            loadingMore: false,
          });
        }
      } catch (e) {
        if (!isAbort(e)) setState({ status: 'error', message: errorMessage(e) });
      }
    };
    run();
    return () => ctl.abort();
  }, [query, mode, retry]);

  const loadMore = async () => {
    if (state.status !== 'done' || state.nextOffset === null || state.loadingMore) return;
    const offset = state.nextOffset;
    const ctl = new AbortController();
    moreCtl.current = ctl;
    setState({ ...state, loadingMore: true, moreError: undefined });
    try {
      if (mode === 'artist') {
        const page = await catalog.searchArtists(query, offset, ctl.signal);
        setState((s) =>
          s.status === 'done'
            ? {
                ...s,
                artists: [...s.artists, ...page.items.filter((a) => !s.artists.some((x) => x.id === a.id))],
                nextOffset: page.nextOffset,
                loadingMore: false,
              }
            : s,
        );
      } else {
        const r = await catalog.searchSongs(query, mode, offset, ctl.signal);
        setState((s) =>
          s.status === 'done'
            ? {
                ...s,
                songs: mergeSongs(s.songs, r.songs.items),
                nextOffset: r.songs.nextOffset,
                loadingMore: false,
              }
            : s,
        );
      }
    } catch (e) {
      if (isAbort(e)) return;
      setState((s) => (s.status === 'done' ? { ...s, loadingMore: false, moreError: errorMessage(e) } : s));
    }
  };

  const setMode = (m: SearchMode) => replaceHash(searchHref(input.trim(), m));

  return (
    <main className="home">
      <header className="home-header">
        <h1>
          <a href="#/" className="home-link">
            שירון אקורדים
          </a>
        </h1>
        <p className="tagline">חיפוש שירים ואמנים בעברית ובאנגלית, ואקורדים כשיש מקור מורשה.</p>
      </header>

      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
          replaceHash(searchHref(input.trim(), mode));
        }}
      >
        <SearchIcon />
        <input
          id="search-input"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={PLACEHOLDER[mode]}
          aria-label="חיפוש"
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={!initialQ}
        />
        {state.status === 'loading' && <span className="spinner" aria-label="מחפש…" />}
      </form>

      <div className="filters" role="tablist" aria-label="חיפוש לפי">
        {(Object.keys(MODE_LABEL) as SearchMode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {mode === 'style' && (
        <div className="chips" aria-label="סגנונות">
          {STYLES.map((s) => (
            <button
              key={s.label}
              className={'chip' + (query === s.label ? ' on' : '')}
              onClick={() => {
                setInput(s.label);
                setQuery(s.label);
                replaceHash(searchHref(s.label, 'style'));
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <section aria-live="polite" className="results">
        {state.status === 'idle' && <IdleView onPick={(q) => setInput(q)} />}
        {state.status === 'loading' && <p className="status">מחפש במאגר…</p>}
        {state.status === 'error' && (
          <div className="notice notice--error" role="alert">
            <p>{state.message}</p>
            <button className="btn" onClick={() => setRetry((r) => r + 1)}>
              נסו שוב
            </button>
          </div>
        )}
        {state.status === 'done' && (
          <>
            {state.artists.length > 0 && (
              <>
                {mode !== 'artist' && (
                  <h2 className="results-heading">{mode === 'style' ? 'אמנים בסגנון' : 'אמנים'}</h2>
                )}
                <ArtistList artists={state.artists} compact={mode !== 'artist'} />
              </>
            )}
            {mode !== 'artist' && state.songs.length > 0 && (
              <>
                <h2 className="results-heading">שירים</h2>
                <SongList songs={state.songs} />
              </>
            )}
            {state.songs.length === 0 && state.artists.length === 0 && (
              <div className="notice">
                <p>
                  לא מצאנו תוצאות עבור <strong>„{query}”</strong>.
                </p>
                <p className="muted">
                  כדאי לבדוק את האיות, לנסות את השם באנגלית או בעברית, או לחפש לפי{' '}
                  {mode === 'artist' ? 'שם השיר' : 'שם האמן'}.
                </p>
              </div>
            )}
            {state.nextOffset !== null && (
              <div className="more">
                <button className="btn" onClick={loadMore} disabled={state.loadingMore}>
                  {state.loadingMore ? 'טוען…' : 'טעינת תוצאות נוספות'}
                </button>
                {state.moreError && (
                  <p className="error-text" role="alert">
                    {state.moreError}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <footer className="site-footer">
        <a href="#/sources">מקורות המידע והאקורדים</a>
        <span>·</span>
        <span>
          נתוני שירים ואמנים:{' '}
          <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">
            MusicBrainz
          </a>
        </span>
      </footer>
    </main>
  );
}

const SUGGESTIONS = [
  'אריק איינשטיין',
  'שלמה ארצי',
  'ירושלים של זהב',
  'Hotel California',
  'The Beatles',
  'Amazing Grace',
];

function IdleView({ onPick }: { onPick: (q: string) => void }) {
  const { favorites } = useFavorites();
  const mine = listUserSheets();
  return (
    <div className="idle">
      {favorites.length > 0 && (
        <>
          <h2 className="results-heading">המועדפים שלי</h2>
          <ul className="song-list">
            {favorites.map((f) => (
              <li key={f.id}>
                <a className="song-item" href={songHref(f.id)}>
                  <span className="song-item-text">
                    <span className="song-item-title">{f.title}</span>
                    <span className="song-item-artist">{f.artist}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {mine.length > 0 && (
        <>
          <h2 className="results-heading">הגיליונות האישיים שלי</h2>
          <ul className="song-list">
            {mine.map((s) => (
              <li key={s.recordingId}>
                <a className="song-item" href={songHref(s.recordingId)}>
                  <span className="song-item-text">
                    <span className="song-item-title">{s.title}</span>
                    <span className="song-item-artist">{s.artist}</span>
                  </span>
                  <span className="badge badge--chords">אקורדים</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="results-heading">אפשר להתחיל מכאן</h2>
      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => onPick(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
