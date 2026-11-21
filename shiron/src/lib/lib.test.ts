import { describe, expect, it } from 'vitest';
import { normalizeLine, parseLine, parseSongText } from './parse';
import { groupRuns, layoutLine } from './layout';
import { normalizeShift, parseChord, transposeChord, transposeKey } from './chords';

const SAMPLE = parseSongText(`{פתיחה}
[Am] [F] [C] [G]

{בית 1}
[Am]דרך חדשה נפתחת מו[Am]לי
מישהו מנגן [B7b9]one more time
[C/D]מחכה לאור [B7sus4]ה[B7]בוקר [Em]

{פזמון}
אז [F]אני שר, ו[C]הלב עונה`);
const songs = [{ sections: SAMPLE }];

describe('parseLine – הפרדת מילים ואקורדים', () => {
  it('שומר מילים נקיות ומיקום מדויק לכל אקורד', () => {
    const l = parseLine('[Am]דרך חדשה נפ[F]תחת');
    expect(l.lyrics).toBe('דרך חדשה נפתחת');
    expect(l.chords).toEqual([
      { at: 0, chord: 'Am' },
      { at: 11, chord: 'F' },
    ]);
    expect(l.lyrics[11]).toBe('ת');
  });

  it('אקורד בסוף השורה', () => {
    const l = parseLine('הגיטרה תמיד איתי[G]');
    expect(l.chords).toEqual([{ at: l.lyrics.length, chord: 'G' }]);
  });

  it('לא מפצל אות מהניקוד שלה', () => {
    const l = normalizeLine({ lyrics: 'שָׁלוֹם', chords: [{ at: 1, chord: 'C' }] });
    expect(l.chords[0].at).toBe(3);
    expect(l.lyrics[3]).toBe('ל');
  });

  it('שורה מעורבת עברית ואנגלית', () => {
    const l = parseLine('מישהו מנגן [B7b9]one more time');
    expect(l.lyrics).toBe('מישהו מנגן one more time');
    expect(l.lyrics.slice(l.chords[0].at)).toBe('one more time');
  });
});

describe('layoutLine – חלוקה למילים וקטעים', () => {
  it('אקורד באמצע מילה מפצל אותה לשני קטעים באותה יחידה', () => {
    const words = layoutLine(parseLine('[Am]דרך חדשה נפ[F]תחת'));
    expect(words).toHaveLength(3);
    expect(words[2].segments).toEqual([
      { chord: undefined, text: 'נפ', start: 9 },
      { chord: 'F', text: 'תחת', start: 11 },
    ]);
    expect(words[0].segments[0]).toEqual({ chord: 'Am', text: 'דרך', start: 0 });
  });

  it('אקורד על רווח מוצמד למילה הבאה', () => {
    const words = layoutLine(parseLine('אז[F] אני שר'));
    expect(words[1].segments[0]).toMatchObject({ chord: 'F', text: 'אני' });
  });

  it('שורת אקורדים בלבד', () => {
    const words = layoutLine(parseLine('[Am] [F] [C] [G]'));
    expect(words.map((w) => w.segments[0].chord)).toEqual(['Am', 'F', 'C', 'G']);
    expect(words.every((w) => w.segments[0].text === '')).toBe(true);
  });

  it('שני אקורדים באותה מילה ואקורד בסוף שורה', () => {
    const words = layoutLine(parseLine('[B7sus4]ה[B7]בוקר [Em]'));
    expect(words[0].segments.map((s) => [s.chord, s.text])).toEqual([
      ['B7sus4', 'ה'],
      ['B7', 'בוקר'],
    ]);
    expect(words[1].segments[0]).toMatchObject({ chord: 'Em', text: '' });
  });

  it('שחזור הטקסט המקורי מהקטעים', () => {
    for (const song of songs)
      for (const sec of song.sections)
        for (const line of sec.lines) {
          const words = layoutLine(line);
          const rebuilt = words
            .map((w) => w.segments.map((s) => s.text).join(''))
            .filter(Boolean)
            .join(' ');
          expect(rebuilt).toBe(line.lyrics.trim().split(/\s+/).filter(Boolean).join(' '));
          const chordCount = words.flatMap((w) => w.segments).filter((s) => s.chord).length;
          expect(chordCount).toBe(line.chords.length);
        }
  });
});

describe('העברת סולם', () => {
  it('מפענח אקורדים מורכבים', () => {
    expect(parseChord('F#m7b5')).toEqual({ root: 6, quality: 'm7b5', bass: undefined });
    expect(parseChord('C/G')).toEqual({ root: 0, quality: '', bass: 7 });
    expect(parseChord('C6/9')).toEqual({ root: 0, quality: '6/9', bass: undefined });
    expect(parseChord('N.C.')).toBeNull();
  });

  it('מעביר שורש, איכות ובס', () => {
    expect(transposeChord('Am', 2, false)).toBe('Bm');
    expect(transposeChord('D/F#', 2, false)).toBe('E/G#');
    expect(transposeChord('F#m7b5', 1, false)).toBe('Gm7b5');
    expect(transposeChord('B7b9', 1, false)).toBe('C7b9');
    expect(transposeChord('Cmaj7', -1, false)).toBe('Bmaj7');
    expect(transposeChord('C6/9', 3, true)).toBe('Eb6/9');
    expect(transposeChord('Bb', 2, false)).toBe('C');
    expect(transposeChord('A7sus4', 1, true)).toBe('Bb7sus4');
    expect(transposeChord('C/D', -2, true)).toBe('Bb/C');
    expect(transposeChord('x2', 3, false)).toBe('x2');
  });

  it('בוחר במול/דיאז לפי הסולם', () => {
    expect(transposeKey('Am', -4)).toEqual({ key: 'Fm', flats: true });
    expect(transposeKey('G', -2)).toEqual({ key: 'F', flats: true });
    expect(transposeKey('G', 2)).toEqual({ key: 'A', flats: false });
    expect(transposeKey('Em', 1)).toEqual({ key: 'Fm', flats: true });
    expect(transposeKey('D', 4)).toEqual({ key: 'F#', flats: false });
    expect(transposeKey('Cmaj7', 0)).toEqual({ key: 'Cmaj7', flats: false });
  });

  it('12 חצאי טונים חוזרים לאותו אקורד', () => {
    for (const c of ['Am', 'D/F#', 'F#m7b5', 'Bbmaj7', 'C#dim7'])
      expect(parseChord(transposeChord(c, 12, false))).toEqual(parseChord(c));
    expect(normalizeShift(7)).toBe(-5);
    expect(normalizeShift(-7)).toBe(5);
    expect(normalizeShift(12)).toBe(0);
  });
});

describe('פענוח טקסט שיר', () => {
  it('קטעי פזמון מזוהים מהכותרת', () => {
    const secs = parseSongText('{פזמון}\n[C]לה לה\n\n{בית 2}\n[G]טה');
    expect(secs.map((s) => [s.kind, s.label])).toEqual([
      ['chorus', 'פזמון'],
      ['verse', 'בית 2'],
    ]);
  });
});

describe('כיווניות – אנגלית בתוך שורה עברית', () => {
  it('מקבץ מילים באנגלית לרצף אחד', () => {
    const runs = groupRuns(layoutLine(parseLine('מישהו מנגן [B7b9]one more time')));
    expect(runs.map((r) => [r.dir, r.words.length])).toEqual([
      ['rtl', 2],
      ['ltr', 3],
    ]);
  });
  it('מספר בין מילים עבריות נשאר ברצף העברי, ובין מילים באנגלית – באנגלית', () => {
    expect(groupRuns(layoutLine(parseLine('שיר 2 שירים'))).map((r) => r.dir)).toEqual(['rtl']);
    expect(
      groupRuns(layoutLine(parseLine('אמר take 5 now ויצא'))).map((r) => [r.dir, r.words.length]),
    ).toEqual([
      ['rtl', 1],
      ['ltr', 3],
      ['rtl', 1],
    ]);
  });
});
