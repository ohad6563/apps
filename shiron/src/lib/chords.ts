/** פענוח והעברת סולם של סימוני אקורדים. */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export interface ParsedChord {
  root: number;
  quality: string;
  bass?: number;
}

const CHORD_RE = /^([A-G])([#b♯♭]?)(.*?)(?:\/([A-G])([#b♯♭]?))?$/;

function noteValue(letter: string, accidental: string): number {
  let v = NATURAL[letter];
  if (accidental === '#' || accidental === '♯') v += 1;
  if (accidental === 'b' || accidental === '♭') v -= 1;
  return (v + 12) % 12;
}

export function parseChord(symbol: string): ParsedChord | null {
  const m = CHORD_RE.exec(symbol.trim());
  if (!m) return null;
  const [, rl, ra, quality, bl, ba] = m;
  return {
    root: noteValue(rl, ra),
    quality,
    bass: bl ? noteValue(bl, ba ?? '') : undefined,
  };
}

/** האם יש להעדיף במול עבור סולם שהשורש שלו הוא `root`. */
export function prefersFlats(root: number, minor: boolean): boolean {
  // מז'ור: F Bb Eb Ab Db (F# ולא Gb). מינור: Dm Gm Cm Fm Bbm Ebm.
  const flatMajor = [5, 10, 3, 8, 1];
  const flatMinor = [2, 7, 0, 5, 10, 3];
  return (minor ? flatMinor : flatMajor).includes(root);
}

export function noteName(value: number, flats: boolean): string {
  const v = ((value % 12) + 12) % 12;
  return (flats ? FLAT_NAMES : SHARP_NAMES)[v];
}

export function transposeChord(symbol: string, semitones: number, flats: boolean): string {
  const p = parseChord(symbol);
  if (!p) return symbol; // סימונים שאינם אקורד (N.C., x2 וכו') נשארים כמו שהם
  const root = noteName(p.root + semitones, flats);
  const bass = p.bass === undefined ? '' : '/' + noteName(p.bass + semitones, flats);
  return root + p.quality + bass;
}

function isMinorQuality(q: string): boolean {
  return /^m(?!aj)/.test(q);
}

/** מחזיר את הסולם אחרי העברה ואת ההעדפה לבמול/דיאז. */
export function transposeKey(key: string | undefined, semitones: number): { key?: string; flats: boolean } {
  const p = key ? parseChord(key) : null;
  if (!p) return { key, flats: false };
  const minor = isMinorQuality(p.quality);
  const root = (p.root + semitones + 120) % 12;
  const flats = prefersFlats(root, minor);
  return { key: noteName(root, flats) + p.quality, flats };
}

/** מנרמל ערך העברה לטווח -6..+6 (מעבר לכך חוזרים על אותם סולמות). */
export function normalizeShift(n: number): number {
  let s = ((n % 12) + 12) % 12;
  if (s > 6) s -= 12;
  return s;
}
