import { useEffect, useMemo, useState } from 'react';
import { catalog, isAbort } from '../catalog/musicbrainz';
import { errorMessage, type SongDetails, type Writer } from '../catalog/types';
import { findSheets, providers, type ContentLookup } from '../content/registry';
import { externalLinks } from '../content/externalLinks';
import type { SongRef } from '../content/types';
import { useFavorites } from '../lib/storage';
import { useWakeLock } from '../lib/useAutoScroll';
import { artistHref, backIfPossible } from '../router';
import { ChordSheetView } from './ChordSheetView';
import { BackIcon, HeartIcon } from './Icons';
import { formatLength } from './Results';
import { SheetEditor } from './SheetEditor';

const ROLE_LABEL: Record<Writer['role'], string> = {
  lyricist: 'מילים',
  composer: 'לחן',
  writer: 'כתיבה',
  arranger: 'עיבוד',
  translator: 'תרגום',
};

type SongState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; song: SongDetails };
type ContentState = { status: 'loading' } | ({ status: 'done' } & ContentLookup);

export const NO_CHORDS_MESSAGE = 'מצאנו את השיר, אבל עדיין אין אקורדים זמינים להצגה.';

export function SongPage({ id }: { id: string }) {
  const [songState, setSongState] = useState<SongState>({ status: 'loading' });
  const [content, setContent] = useState<ContentState>({ status: 'loading' });
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [contentVersion, setContentVersion] = useState(0);
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    window.scrollTo(0, 0);
    setEditing(false);
    setSelected(0);
  }, [id]);

  // 1. נתוני הקטלוג
  useEffect(() => {
    const ctl = new AbortController();
    setSongState({ status: 'loading' });
    catalog.getSong(id, ctl.signal).then(
      (song) => {
        setSongState({ status: 'done', song });
        document.title = `${song.title} – ${song.artist} | שירון אקורדים`;
      },
      (e) => {
        if (!isAbort(e)) setSongState({ status: 'error', message: errorMessage(e) });
      },
    );
    return () => ctl.abort();
  }, [id, retry]);

  const song = songState.status === 'done' ? songState.song : null;
  const ref: SongRef | null = useMemo(
    () =>
      song && {
        recordingId: song.id,
        title: song.title,
        artist: song.artist,
        artistIds: song.artists.map((a) => a.id),
        workIds: song.works.map((w) => w.id),
        isrcs: song.isrcs,
      },
    [song],
  );

  // 2. תוכן האקורדים – שאילתה נפרדת מול ספקי התוכן
  useEffect(() => {
    if (!ref) return;
    const ctl = new AbortController();
    setContent({ status: 'loading' });
    findSheets(ref, ctl.signal).then((r) => {
      if (!ctl.signal.aborted) setContent({ status: 'done', ...r });
    });
    return () => ctl.abort();
  }, [ref, contentVersion]);

  useEffect(() => {
    const on = () => setContentVersion((v) => v + 1);
    window.addEventListener('user-sheets-changed', on);
    return () => window.removeEventListener('user-sheets-changed', on);
  }, []);

  const sheets = content.status === 'done' ? content.sheets : [];
  const sheet = sheets[Math.min(selected, sheets.length - 1)];
  useWakeLock(Boolean(sheet));

  const fav = isFavorite(id);
  const toggleFav = () => song && toggle({ id: song.id, title: song.title, artist: song.artist });

  if (songState.status === 'loading')
    return (
      <main className="song-page">
        <BackLink />
        <p className="status">טוען את השיר…</p>
      </main>
    );
  if (songState.status === 'error')
    return (
      <main className="song-page">
        <BackLink />
        <div className="notice notice--error" role="alert">
          <p>{songState.message}</p>
          <button className="btn" onClick={() => setRetry((r) => r + 1)}>
            נסו שוב
          </button>
        </div>
      </main>
    );

  const s = songState.song;
  const writers = s.works.flatMap((w) => w.writers);
  const byRole = new Map<string, string[]>();
  for (const w of writers) {
    const list = byRole.get(w.role) ?? [];
    if (!list.includes(w.name)) list.push(w.name);
    byRole.set(w.role, list);
  }
  const meta = [s.year, formatLength(s.lengthMs)].filter(Boolean).join(' · ');

  return (
    <main className="song-page">
      <header className="song-header">
        <BackLink />
        <h1 className="song-title">
          <bdi>{s.title}</bdi>
        </h1>
        <p className="song-artist">
          {s.artists.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <a href={artistHref(a.id)}>
                <bdi>{a.name}</bdi>
              </a>
            </span>
          ))}
          {meta && (
            <span className="muted">
              {' · '}
              <bdi dir="ltr">{meta}</bdi>
            </span>
          )}
        </p>
        {byRole.size > 0 && (
          <p className="writers">
            {[...byRole].map(([role, names]) => (
              <span key={role}>
                {ROLE_LABEL[role as Writer['role']]}: <bdi>{names.join(', ')}</bdi>
              </span>
            ))}
          </p>
        )}
        {s.tags.length > 0 && (
          <ul className="song-meta">
            {s.tags.map((t) => (
              <li key={t} className="badge" dir="auto">
                {t}
              </li>
            ))}
          </ul>
        )}
      </header>

      {editing && ref ? (
        <SheetEditor songRef={ref} onClose={() => setEditing(false)} />
      ) : content.status === 'loading' ? (
        <p className="status">מחפש אקורדים במקורות המורשים…</p>
      ) : sheet ? (
        <>
          {sheets.length > 1 && (
            <div className="filters" role="tablist" aria-label="מקור האקורדים">
              {sheets.map((sh, i) => (
                <button key={sh.id} role="tab" aria-selected={sh === sheet} onClick={() => setSelected(i)}>
                  {sh.source.name}
                </button>
              ))}
            </div>
          )}
          {sheet.note && <p className="sheet-note">{sheet.note}</p>}
          <ChordSheetView sheet={sheet} favorite={fav} onToggleFavorite={toggleFav} />
          <p className="credit">
            מקור: {sheet.source.url ? <a href={sheet.source.url}>{sheet.source.name}</a> : sheet.source.name}.{' '}
            {sheet.source.license}
            {sheet.editable && (
              <>
                {' '}
                <button className="link-btn" onClick={() => setEditing(true)}>
                  עריכת הגיליון
                </button>
              </>
            )}
          </p>
        </>
      ) : (
        <NoChords
          title={s.title}
          artist={s.artist}
          failed={content.failed}
          favorite={fav}
          onToggleFavorite={toggleFav}
          onAdd={() => setEditing(true)}
        />
      )}

      <p className="credit">
        פרטי השיר:{' '}
        <a href={s.sourceUrl} target="_blank" rel="noreferrer">
          MusicBrainz
        </a>
      </p>
    </main>
  );
}

function BackLink() {
  return (
    <a href="#/" className="back-link" onClick={backIfPossible}>
      <BackIcon />
      <span>חזרה לחיפוש</span>
    </a>
  );
}

function NoChords({
  title,
  artist,
  failed,
  favorite,
  onToggleFavorite,
  onAdd,
}: {
  title: string;
  artist: string;
  failed: ContentLookup['failed'];
  favorite: boolean;
  onToggleFavorite: () => void;
  onAdd: () => void;
}) {
  const checked = providers.filter((p) => p.isEnabled()).map((p) => p.name);
  return (
    <section className="no-chords" aria-labelledby="no-chords-title">
      <h2 id="no-chords-title">{NO_CHORDS_MESSAGE}</h2>
      {failed.length > 0 ? (
        <p className="error-text" role="alert">
          חלק ממקורות האקורדים לא ענו כרגע ({failed.map((f) => f.provider).join(', ')}). ייתכן שיש אקורדים –
          נסו שוב מאוחר יותר.
        </p>
      ) : (
        <p className="muted">חיפשנו ב: {checked.join(' · ')}. אנחנו לא מציגים אקורדים בלי מקור מורשה.</p>
      )}
      <div className="no-chords-actions">
        <button className="btn btn--primary" onClick={onAdd}>
          הוספת אקורדים משלי
        </button>
        <button
          className={'btn' + (favorite ? ' on' : '')}
          onClick={onToggleFavorite}
          aria-pressed={favorite}
        >
          <HeartIcon filled={favorite} /> {favorite ? 'נשמר במועדפים' : 'שמירה במועדפים'}
        </button>
      </div>
      <p className="muted small">גיליון אישי נשמר רק בדפדפן שלכם ומוצג רק לכם.</p>
      <h3>חיפוש באתרים אחרים</h3>
      <ul className="external-links">
        {externalLinks(title, artist).map((l) => (
          <li key={l.name}>
            <a href={l.url} target="_blank" rel="noreferrer noopener">
              {l.name}
            </a>{' '}
            <span className="muted">– {l.hint}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">קישורים חיצוניים בלבד. השירון לא מעתיק ולא מציג תוכן מאתרים אלה.</p>
    </section>
  );
}
