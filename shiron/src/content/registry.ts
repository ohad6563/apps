/**
 * רישום ספקי התוכן. להוספת מקור חדש: מממשים ChordProvider ומוסיפים לרשימה – זה הכול.
 * הסדר קובע את סדר ההצגה: גיליון אישי קודם, אחריו ספק מורשה, ובסוף נחלת הכלל.
 */
import type { ChordProvider, ChordSheet, SongRef } from './types';
import { userSheetsProvider } from './userSheets';
import { remoteProvider } from './remoteApi';
import { publicDomainProvider } from './publicDomain';

export const providers: ChordProvider[] = [userSheetsProvider, remoteProvider, publicDomainProvider];

export interface ContentLookup {
  sheets: ChordSheet[];
  /** ספקים שנכשלו – מוצג למשתמש כדי שלא יחשוב שאין תוכן כשבעצם הייתה תקלה. */
  failed: { provider: string; message: string }[];
}

export async function findSheets(
  ref: SongRef,
  signal?: AbortSignal,
  list: ChordProvider[] = providers,
): Promise<ContentLookup> {
  const active = list.filter((p) => p.isEnabled());
  const results = await Promise.allSettled(active.map((p) => p.find(ref, signal)));
  const out: ContentLookup = { sheets: [], failed: [] };
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') out.sheets.push(...r.value);
    else if (!(r.reason instanceof DOMException && r.reason.name === 'AbortError'))
      out.failed.push({ provider: active[i].name, message: String(r.reason?.message ?? r.reason) });
  });
  return out;
}

/** true רק כשספק מקומי יודע בוודאות שיש תוכן. לא מנחשים. */
export function hasKnownSheet(
  ref: Pick<SongRef, 'recordingId' | 'title' | 'artist'>,
  list = providers,
): boolean {
  return list.some((p) => p.isEnabled() && p.quickCheck?.(ref) === true);
}
