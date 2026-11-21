/**
 * שכבת התוכן: אקורדים, מילים וטאבים.
 * נפרדת מהקטלוג. כל ספק תוכן מממש את `ChordProvider` ונרשם ב-registry.ts.
 * כך אפשר להוסיף מקור מורשה חדש (API של שותף, מאגר פנימי) בלי לגעת בממשק.
 */
import type { Difficulty, Section } from '../lib/model';

/** מה שהקטלוג יודע על השיר – מועבר לספקי התוכן לצורך התאמה. */
export interface SongRef {
  recordingId: string;
  title: string;
  artist: string;
  artistIds: string[];
  workIds: string[];
  isrcs: string[];
}

export interface ContentSource {
  providerId: string;
  /** שם המקור כפי שמוצג למשתמש. */
  name: string;
  /** בסיס חוקי להצגה: נחלת הכלל / רישיון / תוכן אישי של המשתמש. */
  license: string;
  url?: string;
}

/** גיליון אקורדים במבנה אחיד, ללא קשר למקור. */
export interface ChordSheet {
  id: string;
  title: string;
  artist: string;
  key?: string;
  capo?: number;
  difficulty?: Difficulty;
  scrollSpeed?: number;
  sections: Section[];
  tab?: string;
  tabTitle?: string;
  source: ContentSource;
  /** הערה למשתמש (למשל: "גרסת נחלת הכלל; הביצוע הזה עשוי להיות שונה"). */
  note?: string;
  /** האם המשתמש יכול לערוך (גיליון אישי). */
  editable?: boolean;
}

export interface ChordProvider {
  readonly id: string;
  readonly name: string;
  /** תיאור קצר של מקור התוכן ובסיס הרישוי, להצגה בעמוד "מקורות". */
  readonly description: string;
  isEnabled(): boolean;
  /** בדיקה מקומית ומהירה (בלי רשת) – לסימון "יש אקורדים" ברשימת תוצאות. undefined = לא ידוע. */
  quickCheck?(ref: Pick<SongRef, 'recordingId' | 'title' | 'artist'>): boolean | undefined;
  find(ref: SongRef, signal?: AbortSignal): Promise<ChordSheet[]>;
}
