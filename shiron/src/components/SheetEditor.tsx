import { useMemo, useState } from 'react';
import { parseSongText } from '../lib/parse';
import type { SongRef } from '../content/types';
import { deleteUserSheet, getUserSheet, saveUserSheet } from '../content/userSheets';
import { SongSheet } from './SongSheet';

const EXAMPLE = `{בית 1}
[Am]כאן כותבים את המי[F]לים
[C]והאקורד בסוגריים ממש לפני ה[G]הברה

{פזמון}
[F]שורה של פז[G]מון`;

/** עורך גיליון אישי: טקסט בפורמט [Am]מילים, עם תצוגה מקדימה חיה. */
export function SheetEditor({ songRef, onClose }: { songRef: SongRef; onClose: () => void }) {
  const existing = getUserSheet(songRef);
  const [text, setText] = useState(existing?.text ?? '');
  const [key, setKey] = useState(existing?.key ?? '');
  const [error, setError] = useState<string | null>(null);
  const sections = useMemo(() => parseSongText(text), [text]);
  const hasChords = sections.some((s) => s.lines.some((l) => l.chords.length > 0));

  const save = () => {
    if (!text.trim()) return setError('הגיליון ריק.');
    if (!hasChords) return setError('לא נמצאו אקורדים. כתבו אקורד בסוגריים מרובעים, למשל [Am].');
    try {
      saveUserSheet(songRef, text, key.trim());
      onClose();
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

  return (
    <section className="editor" aria-label="עריכת גיליון אישי">
      <h2>{existing ? 'עריכת הגיליון האישי' : 'הוספת אקורדים משלי'}</h2>
      <p className="muted">
        כתבו כל אקורד בסוגריים מרובעים ממש לפני ההברה שבה הוא מתחלף. שורה ריקה מפרידה בין בתים, וכותרת כמו{' '}
        <code>{'{פזמון}'}</code> מסמנת קטע. הגיליון נשמר רק בדפדפן הזה, לשימושכם האישי.
      </p>
      <label className="field">
        <span>סולם (לא חובה)</span>
        <input
          id="sheet-key"
          dir="ltr"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Am"
        />
      </label>
      <label className="field">
        <span>מילים ואקורדים</span>
        <textarea
          id="sheet-text"
          dir="rtl"
          rows={12}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder={EXAMPLE}
        />
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="no-chords-actions">
        <button className="btn btn--primary" onClick={save}>
          שמירה
        </button>
        <button className="btn" onClick={onClose}>
          ביטול
        </button>
        {existing && (
          <button
            className="btn btn--danger"
            onClick={() => {
              deleteUserSheet(songRef);
              onClose();
            }}
          >
            מחיקת הגיליון
          </button>
        )}
      </div>
      {text.trim() && (
        <>
          <h3>תצוגה מקדימה</h3>
          <div className="preview">
            <SongSheet sections={sections} renderChord={(c) => c} />
          </div>
        </>
      )}
    </section>
  );
}
