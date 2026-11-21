/**
 * ספק תוכן: גיליונות אישיים.
 * המשתמש כותב או מדביק אקורדים לשיר (בפורמט [Am]מילים) לשימושו האישי.
 * הגיליון נשמר רק בדפדפן שלו, משויך לשיר בקטלוג, ולא נשלח לשום שרת.
 */
import { normalizeText, titleKey } from '../catalog/query';
import { parseSongText } from '../lib/parse';
import type { ChordProvider, ChordSheet, SongRef } from './types';

const STORAGE_KEY = 'userSheets:v1';

export interface StoredSheet {
  recordingId: string;
  match: string;
  title: string;
  artist: string;
  key?: string;
  text: string;
  updatedAt: number;
}

function matchKey(title: string, artist: string) {
  return titleKey(title) + '|' + normalizeText(artist);
}

function readAll(): Record<string, StoredSheet> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, StoredSheet>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    throw new Error('לא ניתן לשמור בדפדפן הזה (ייתכן שמצב גלישה פרטית).');
  }
  window.dispatchEvent(new CustomEvent('user-sheets-changed'));
}

export function getUserSheet(
  ref: Pick<SongRef, 'recordingId' | 'title' | 'artist'>,
): StoredSheet | undefined {
  const all = readAll();
  if (all[ref.recordingId]) return all[ref.recordingId];
  const m = matchKey(ref.title, ref.artist);
  return Object.values(all).find((s) => s.match === m);
}

export function saveUserSheet(
  ref: Pick<SongRef, 'recordingId' | 'title' | 'artist'>,
  text: string,
  key?: string,
) {
  const all = readAll();
  all[ref.recordingId] = {
    recordingId: ref.recordingId,
    match: matchKey(ref.title, ref.artist),
    title: ref.title,
    artist: ref.artist,
    key: key || undefined,
    text,
    updatedAt: Date.now(),
  };
  writeAll(all);
}

export function deleteUserSheet(ref: Pick<SongRef, 'recordingId' | 'title' | 'artist'>) {
  const all = readAll();
  const existing = getUserSheet(ref);
  if (existing) delete all[existing.recordingId];
  writeAll(all);
}

export function listUserSheets(): StoredSheet[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function toSheet(s: StoredSheet): ChordSheet {
  return {
    id: `user:${s.recordingId}`,
    title: s.title,
    artist: s.artist,
    key: s.key,
    sections: parseSongText(s.text),
    source: {
      providerId: 'user',
      name: 'הגיליון האישי שלי',
      license: 'תוכן שהזנתם בעצמכם לשימוש אישי. נשמר רק בדפדפן הזה.',
    },
    editable: true,
  };
}

export const userSheetsProvider: ChordProvider = {
  id: 'user',
  name: 'גיליונות אישיים',
  description: 'אקורדים שהזנתם בעצמכם לשיר מסוים. נשמרים רק בדפדפן שלכם.',
  isEnabled: () => true,
  quickCheck: (ref) => Boolean(getUserSheet(ref)),
  async find(ref) {
    const s = getUserSheet(ref);
    return s ? [toSheet(s)] : [];
  },
};
