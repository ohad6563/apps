import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findSheets, hasKnownSheet } from './registry';
import { publicDomainProvider } from './publicDomain';
import { createRemoteProvider } from './remoteApi';
import { deleteUserSheet, getUserSheet, saveUserSheet, userSheetsProvider } from './userSheets';
import { externalLinks } from './externalLinks';
import type { ChordProvider, SongRef } from './types';

// localStorage + window מינימליים לסביבת node
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal('window', { dispatchEvent: () => true });

const ref = (title: string, artist = 'Someone', id = '11111111-1111-1111-1111-111111111111'): SongRef => ({
  recordingId: id,
  title,
  artist,
  artistIds: [],
  workIds: [],
  isrcs: [],
});

beforeEach(() => store.clear());

describe('ספק נחלת הכלל', () => {
  it('מתאים לפי שם השיר, גם בשמות חלופיים ובעברית', async () => {
    expect((await publicDomainProvider.find(ref('Amazing Grace', 'Elvis Presley')))[0].title).toBe('Amazing Grace');
    expect(await publicDomainProvider.find(ref('Oh Susanna (Live)'))).toHaveLength(1);
    expect(await publicDomainProvider.find(ref('הבה נגילה'))).toHaveLength(1);
    expect(await publicDomainProvider.find(ref('Hava Nagila'))).toHaveLength(1);
  });

  it('לא ממציא תוכן לשיר שאין לו מקור', async () => {
    expect(await publicDomainProvider.find(ref('Hotel California', 'Eagles'))).toEqual([]);
    expect(await publicDomainProvider.find(ref('ירושלים של זהב', 'נעמי שמר'))).toEqual([]);
  });

  it('כל גיליון כולל אקורדים מעל מילים ובסיס רישוי', async () => {
    const [s] = await publicDomainProvider.find(ref('Amazing Grace'));
    expect(s.source.license).toMatch(/נחלת הכלל/);
    const lines = s.sections.flatMap((x) => x.lines);
    expect(lines.filter((l) => l.chords.length).length).toBeGreaterThan(5);
    expect(lines[0].lyrics.startsWith('Amazing')).toBe(true);
  });
});

describe('גיליונות אישיים', () => {
  it('שמירה, שליפה לפי מזהה או לפי שם+אמן, ומחיקה', async () => {
    const r = ref('שיר שלי', 'אמן');
    expect(await userSheetsProvider.find(r)).toEqual([]);
    saveUserSheet(r, '[Am]שורה [G]ראשונה', 'Am');
    const [s] = await userSheetsProvider.find(r);
    expect(s.editable).toBe(true);
    expect(s.sections[0].lines[0].chords.map((c) => c.chord)).toEqual(['Am', 'G']);
    // הקלטה אחרת של אותו שיר ואותו אמן
    expect(getUserSheet(ref('שיר שלי', 'אמן', 'other-id'))).toBeDefined();
    deleteUserSheet(r);
    expect(await userSheetsProvider.find(r)).toEqual([]);
  });
});

describe('ספק API מורשה', () => {
  it('כבוי כשאין כתובת', async () => {
    const p = createRemoteProvider(undefined);
    expect(p.isEnabled()).toBe(false);
    expect(await p.find(ref('x'))).toEqual([]);
  });

  it('שולח מזהים ומחזיר גיליון במבנה האחיד', async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sheets: [
            {
              id: '7',
              title: 'T',
              artist: 'A',
              key: 'G',
              chordpro: '[G]la [C]la',
              source: { name: 'Licensed Co', license: 'רישיון 2026' },
            },
            { id: 'bad', title: 'no license', artist: 'A', chordpro: '[G]x', source: { name: 'X' } },
          ],
        }),
      ),
    );
    const p = createRemoteProvider('https://api.example.com/v1/', f as unknown as typeof fetch);
    const sheets = await p.find({ ...ref('T', 'A'), workIds: ['w1'], isrcs: ['US123'] });
    const url = String(f.mock.calls[0][0]);
    expect(url).toMatch(/^https:\/\/api\.example\.com\/v1\/sheets\?/);
    expect(url).toContain('work=w1');
    expect(url).toContain('isrc=US123');
    expect(sheets).toHaveLength(1); // גיליון בלי רישיון נדחה
    expect(sheets[0].source.name).toBe('Licensed Co');
  });
});

describe('רישום הספקים', () => {
  it('ספק שנכשל מדווח, ולא נחשב "אין אקורדים"', async () => {
    const broken: ChordProvider = {
      id: 'b',
      name: 'שבור',
      description: '',
      isEnabled: () => true,
      find: () => Promise.reject(new Error('HTTP 500')),
    };
    const r = await findSheets(ref('Amazing Grace'), undefined, [broken, publicDomainProvider]);
    expect(r.sheets).toHaveLength(1);
    expect(r.failed).toEqual([{ provider: 'שבור', message: 'HTTP 500' }]);
  });

  it('סימון "יש אקורדים" רק כשבאמת ידוע', () => {
    expect(hasKnownSheet(ref('Amazing Grace'))).toBe(true);
    expect(hasKnownSheet(ref('Hotel California'))).toBe(false);
  });

  it('קישורים חיצוניים: Tab4u קודם לשיר בעברית', () => {
    expect(externalLinks('ירושלים של זהב', 'נעמי שמר')[0].name).toBe('Tab4u');
    expect(externalLinks('Hotel California', 'Eagles')[0].name).toBe('Ultimate Guitar');
  });
});
