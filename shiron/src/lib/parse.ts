import type { ChordMark, Section, SectionKind, SongLine } from './model';

/**
 * ממיר שורה בכתיב "אינליין" (בסגנון ChordPro) למודל המובנה.
 * לדוגמה: "[Am]דרך חדשה נפ[F]תחת" →
 *   { lyrics: "דרך חדשה נפתחת", chords: [{at:0, chord:"Am"}, {at:12, chord:"F"}] }
 *
 * זהו רק פורמט כתיבה נוח לעורכי השירים; לאחר הפענוח המילים והאקורדים מופרדים לגמרי.
 */
export function parseLine(source: string): SongLine {
  let lyrics = '';
  const chords: ChordMark[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    lyrics += source.slice(last, m.index);
    chords.push({ at: lyrics.length, chord: m[1].trim() });
    last = m.index + m[0].length;
  }
  lyrics += source.slice(last);
  return normalizeLine({ lyrics, chords });
}

const COMBINING = /[֑-ׇ̀-ͯ]/; // ניקוד וטעמים, סימנים צירופיים

/**
 * מוודא שכל נקודת אקורד חוקית:
 *  - בתחום 0..אורך השורה
 *  - לא באמצע צירוף אות+ניקוד (מזיז קדימה אל האות הבאה)
 *  - ממוינת לפי מיקום
 */
export function normalizeLine(line: SongLine): SongLine {
  const { lyrics } = line;
  const chords = line.chords
    .map((c) => {
      let at = Math.max(0, Math.min(lyrics.length, Math.round(c.at)));
      while (at < lyrics.length && at > 0 && COMBINING.test(lyrics[at])) at++;
      return { at, chord: c.chord };
    })
    .sort((a, b) => a.at - b.at);
  return { lyrics, chords };
}

const KIND_ALIASES: Record<string, SectionKind> = {
  פתיחה: 'intro',
  בית: 'verse',
  פזמון: 'chorus',
  גשר: 'bridge',
  סיום: 'outro',
  מעבר: 'instrumental',
  intro: 'intro',
  verse: 'verse',
  chorus: 'chorus',
  bridge: 'bridge',
  outro: 'outro',
};

/**
 * מפענח טקסט שיר שלם. בלוקים מופרדים בשורה ריקה.
 * שורה ראשונה בבלוק בצורה "{פזמון}" או "{בית 2}" קובעת את סוג הקטע.
 */
export function parseSongText(text: string): Section[] {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').filter((l) => l.trim() !== ''))
    .filter((b) => b.length > 0);

  return blocks.map((lines) => {
    let kind: SectionKind = 'verse';
    let label: string | undefined;
    const head = /^\{\s*([^}]+?)\s*\}$/.exec(lines[0].trim());
    if (head) {
      label = head[1];
      const word = label.split(/\s+/)[0].toLowerCase();
      kind = KIND_ALIASES[word] ?? 'verse';
      lines = lines.slice(1);
    }
    return { kind, label, lines: lines.map((l) => parseLine(l.trim())) };
  });
}
