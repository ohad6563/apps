import { useCallback, useEffect, useMemo, useState } from 'react';
import { DIFFICULTY_LABEL } from '../lib/model';
import { normalizeShift, transposeChord, transposeKey } from '../lib/chords';
import { usePersistent } from '../lib/storage';
import { useAutoScroll } from '../lib/useAutoScroll';
import type { ChordSheet } from '../content/types';
import { SongSheet } from './SongSheet';
import { Toolbar } from './Toolbar';

export const FONT_SIZES = [15, 17, 19, 21, 24, 27, 30, 34];
export const DEFAULT_FONT_INDEX = 3;

type View = 'chords' | 'tab';

/** מילים עם אקורדים מעליהן + סרגל כלים. ללא תלות במקור התוכן. */
export function ChordSheetView({
  sheet,
  favorite,
  onToggleFavorite,
}: {
  sheet: ChordSheet;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [rawShift, setShift] = usePersistent<number>(`shift:${sheet.id}`, 0);
  const shift = normalizeShift(rawShift);
  const [fontIndex, setFontIndex] = usePersistent<number>('fontIndex', DEFAULT_FONT_INDEX);
  const fi = Math.max(0, Math.min(FONT_SIZES.length - 1, fontIndex));
  const scroll = useAutoScroll(sheet.scrollSpeed ?? 3);
  const [view, setView] = useState<View>('chords');
  const { stop } = scroll;

  useEffect(() => {
    stop();
    setView('chords');
  }, [sheet.id, stop]);

  const { key: shownKey, flats } = useMemo(
    () => transposeKey(sheet.key ?? firstChord(sheet), shift),
    [sheet, shift],
  );

  const renderChord = useCallback(
    (c: string) => (shift === 0 ? c : transposeChord(c, shift, flats)),
    [shift, flats],
  );

  return (
    <div className="sheet-wrap" style={{ ['--lyric-size' as string]: `${FONT_SIZES[fi]}px` }}>
      <ul className="song-meta">
        {sheet.difficulty && (
          <li className={`badge badge--${sheet.difficulty}`}>רמה: {DIFFICULTY_LABEL[sheet.difficulty]}</li>
        )}
        {shownKey && (
          <li className="badge">
            סולם: <bdi dir="ltr">{shownKey}</bdi>
          </li>
        )}
        {sheet.capo ? <li className="badge">קאפו {sheet.capo}</li> : null}
      </ul>
      {sheet.tab && (
        <div className="view-switch" role="tablist" aria-label="סוג תצוגה">
          <button role="tab" aria-selected={view === 'chords'} onClick={() => setView('chords')}>
            מילים ואקורדים
          </button>
          <button role="tab" aria-selected={view === 'tab'} onClick={() => setView('tab')}>
            טאבים
          </button>
        </div>
      )}

      {view === 'chords' ? (
        <SongSheet sections={sheet.sections} renderChord={renderChord} />
      ) : (
        <div className="tab-view">
          {sheet.tabTitle && <h2 className="tab-title">{sheet.tabTitle}</h2>}
          {shift !== 0 && <p className="tab-note">הטאבים מוצגים בסולם המקורי.</p>}
          <pre dir="ltr">{sheet.tab}</pre>
        </div>
      )}

      <Toolbar
        shift={shift}
        onTranspose={(d) => setShift((s) => normalizeShift(s + d))}
        onResetTranspose={() => setShift(0)}
        canSmaller={fi > 0}
        canBigger={fi < FONT_SIZES.length - 1}
        onFont={(d) => setFontIndex(Math.max(0, Math.min(FONT_SIZES.length - 1, fi + d)))}
        scrolling={scroll.active}
        speed={scroll.speed}
        onToggleScroll={scroll.toggle}
        onSpeed={(d) => (d > 0 ? scroll.faster() : scroll.slower())}
        favorite={favorite}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

function firstChord(sheet: ChordSheet): string | undefined {
  for (const s of sheet.sections) for (const l of s.lines) if (l.chords[0]) return l.chords[0].chord;
  return undefined;
}
