/**
 * מודל הנתונים של שיר.
 *
 * המילים והאקורדים נשמרים בנפרד: כל שורה מחזיקה את הטקסט שלה כמחרוזת נקייה,
 * ורשימה של נקודות החלפת אקורד – כל אחת עם אינדקס מדויק בתוך הטקסט.
 * אין רווחים ידניים ואין "שורת אקורדים" נפרדת, ולכן היישור לא תלוי בגופן,
 * ברוחב המסך או בכיוון הכתיבה.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ChordMark {
  /** אינדקס (UTF-16) של התו בשורה שבו מתבצעת החלפת האקורד. יכול להיות שווה לאורך השורה (אקורד בסוף השורה). */
  at: number;
  /** סימון האקורד, כפי שנכתב בסולם המקורי, למשל "Am", "F#m7b5", "C/G". */
  chord: string;
}

export interface SongLine {
  lyrics: string;
  chords: ChordMark[];
}

export type SectionKind = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'instrumental';

export interface Section {
  kind: SectionKind;
  /** כותרת קצרה להצגה, למשל "בית 1" או "פזמון". */
  label?: string;
  lines: SongLine[];
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'קל',
  medium: 'בינוני',
  hard: 'מתקדם',
};

export const SECTION_LABEL: Record<SectionKind, string> = {
  intro: 'פתיחה',
  verse: 'בית',
  chorus: 'פזמון',
  bridge: 'גשר',
  outro: 'סיום',
  instrumental: 'מעבר',
};
