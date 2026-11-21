import type { SongLine } from './model';

/** קטע טקסט עם אקורד אופציונלי שמתחיל בתחילתו. */
export interface Segment {
  chord?: string;
  text: string;
  /** אינדקס תחילת הקטע בשורה המקורית (לבדיקות). */
  start: number;
}

/** מילה = יחידה שלא נשברת בין שורות. מילה עם אקורד באמצעה מחולקת לכמה קטעים. */
export interface Word {
  segments: Segment[];
  /** כיוון המילה לפי התו החזק הראשון בה; neutral = מספרים/סימנים בלבד. */
  dir: TextDir;
}

export type TextDir = 'rtl' | 'ltr' | 'neutral';

const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CHAR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

export function textDir(text: string): TextDir {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return 'rtl';
    if (LTR_CHAR.test(ch)) return 'ltr';
  }
  return 'neutral';
}

/** רצף מילים באותו כיוון. בשורה עברית, רצף אנגלי מוצג כיחידה משמאל לימין. */
export interface Run {
  dir: 'rtl' | 'ltr';
  words: Word[];
}

/**
 * מקבץ מילים לרצפים לפי כיוון (גרסה פשוטה של אלגוריתם ה-bidi):
 * מילים ניטרליות (מספרים, סימנים, אקורד בלי מילה) שנמצאות בין שתי מילים באנגלית
 * מצטרפות לרצף האנגלי; אחרת הן מקבלות את כיוון הפסקה.
 */
export function groupRuns(words: Word[], base: 'rtl' | 'ltr' = 'rtl'): Run[] {
  const resolved = words.map((w) => w.dir);
  for (let i = 0; i < resolved.length; i++) {
    if (resolved[i] !== 'neutral') continue;
    let j = i;
    while (j < resolved.length && resolved[j] === 'neutral') j++;
    const before = i > 0 ? resolved[i - 1] : base;
    const after = j < resolved.length ? resolved[j] : base;
    const d = before === after ? before : base;
    for (let k = i; k < j; k++) resolved[k] = d;
    i = j - 1;
  }
  const runs: Run[] = [];
  words.forEach((w, i) => {
    const d = resolved[i] as 'rtl' | 'ltr';
    const last = runs[runs.length - 1];
    if (last && last.dir === d) last.words.push(w);
    else runs.push({ dir: d, words: [w] });
  });
  return runs;
}

/**
 * מחלק שורה ליחידות תצוגה: מילים, וכל מילה לקטעים לפי נקודות החלפת האקורד.
 * כך כל אקורד מוצג בראש עמודה שמתחילה בדיוק בתו שאליו הוא שייך,
 * והדפדפן אחראי ליישור – בלי רווחים ידניים.
 */
export function layoutLine(line: SongLine): Word[] {
  const { lyrics } = line;
  // גבולות מילים
  const words: { start: number; end: number }[] = [];
  const wordRe = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(lyrics))) words.push({ start: m.index, end: m.index + m[0].length });

  // שיוך כל אקורד למילה
  const chords = line.chords.map((c) => ({ ...c }));
  const isSpace = (i: number) => i >= lyrics.length || /\s/.test(lyrics[i]);
  for (let k = 0; k < chords.length; k++) {
    const c = chords[k];
    if (c.at < lyrics.length && !isSpace(c.at)) continue;
    // אקורד שנכתב על רווח: מוצמד לתחילת המילה הבאה, אם אין אקורד אחר בדרך
    const next = words.find((w) => w.start > c.at);
    const nextChord = chords[k + 1];
    if (next && (!nextChord || nextChord.at > next.start)) c.at = next.start;
  }

  const out: Word[] = [];
  let ci = 0;
  for (const w of words) {
    // אקורדים עצמאיים לפני המילה (על רווחים, ללא מילה משויכת)
    while (ci < chords.length && chords[ci].at < w.start) {
      out.push({ segments: [{ chord: chords[ci].chord, text: '', start: chords[ci].at }], dir: 'neutral' });
      ci++;
    }
    const segs: Segment[] = [];
    let pos = w.start;
    let pendingChord: string | undefined;
    while (ci < chords.length && chords[ci].at < w.end) {
      const at = chords[ci].at;
      if (at > pos || pendingChord !== undefined) {
        segs.push({ chord: pendingChord, text: lyrics.slice(pos, at), start: pos });
      }
      pendingChord = chords[ci].chord;
      pos = at;
      ci++;
    }
    segs.push({ chord: pendingChord, text: lyrics.slice(pos, w.end), start: pos });
    out.push({ segments: segs, dir: textDir(lyrics.slice(w.start, w.end)) });
  }
  // אקורדים אחרי המילה האחרונה
  while (ci < chords.length) {
    out.push({ segments: [{ chord: chords[ci].chord, text: '', start: chords[ci].at }], dir: 'neutral' });
    ci++;
  }
  return out;
}

export function lineHasChords(line: SongLine): boolean {
  return line.chords.length > 0;
}
