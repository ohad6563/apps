import { useEffect, useState } from 'react';
import { catalog, isAbort } from '../catalog/musicbrainz';
import { mergeSongs } from '../catalog/query';
import { errorMessage, type ArtistSummary, type SongSummary } from '../catalog/types';
import { backIfPossible } from '../router';
import { BackIcon } from './Icons';
import { SongList } from './Results';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'done';
      artist: ArtistSummary;
      songs: SongSummary[];
      nextOffset: number | null;
      total: number;
      loadingMore: boolean;
      moreError?: string;
    };

export function ArtistPage({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setState({ status: 'loading' });
    (async () => {
      try {
        const artist = await catalog.getArtist(id, ctl.signal);
        document.title = `${artist.name} | שירון אקורדים`;
        const page = await catalog.artistSongs(id, 0, ctl.signal);
        setState({
          status: 'done',
          artist,
          songs: page.items,
          nextOffset: page.nextOffset,
          total: page.total,
          loadingMore: false,
        });
      } catch (e) {
        if (!isAbort(e)) setState({ status: 'error', message: errorMessage(e) });
      }
    })();
    return () => ctl.abort();
  }, [id, retry]);

  const loadMore = async () => {
    if (state.status !== 'done' || state.nextOffset === null) return;
    const offset = state.nextOffset;
    setState({ ...state, loadingMore: true, moreError: undefined });
    try {
      const page = await catalog.artistSongs(id, offset);
      setState((s) =>
        s.status === 'done'
          ? { ...s, songs: mergeSongs(s.songs, page.items), nextOffset: page.nextOffset, loadingMore: false }
          : s,
      );
    } catch (e) {
      setState((s) => (s.status === 'done' ? { ...s, loadingMore: false, moreError: errorMessage(e) } : s));
    }
  };

  return (
    <main className="home">
      <a href="#/" className="back-link" onClick={backIfPossible}>
        <BackIcon />
        <span>חזרה לחיפוש</span>
      </a>
      {state.status === 'loading' && <p className="status">טוען את האמן…</p>}
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
          <header className="song-header">
            <h1 className="song-title">
              <bdi>{state.artist.name}</bdi>
            </h1>
            {state.artist.disambiguation && <p className="song-artist">{state.artist.disambiguation}</p>}
            {state.artist.aliases.length > 0 && (
              <p className="muted">
                שמות נוספים: <bdi>{state.artist.aliases.slice(0, 6).join(', ')}</bdi>
              </p>
            )}
            {state.artist.tags.length > 0 && (
              <ul className="song-meta">
                {state.artist.tags.map((t) => (
                  <li key={t} className="badge" dir="auto">
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </header>
          <h2 className="results-heading">שירים</h2>
          {state.songs.length === 0 ? (
            <p className="notice">לא נמצאו שירים לאמן הזה במאגר.</p>
          ) : (
            <SongList songs={state.songs} hideArtist />
          )}
          {state.nextOffset !== null && (
            <div className="more">
              <button className="btn" onClick={loadMore} disabled={state.loadingMore}>
                {state.loadingMore ? 'טוען…' : 'שירים נוספים'}
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
    </main>
  );
}
