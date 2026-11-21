import { describe, expect, it, vi } from 'vitest';
import {
  buildArtistQuery,
  buildRecordingQuery,
  escapeLucene,
  groupAndRank,
  mergeSongs,
  normalizeText,
  styleTags,
  titleKey,
  tokenize,
} from './query';
import { mapArtist, mapRecording, mapRecordingDetails, MusicBrainzCatalog } from './musicbrainz';
import { CatalogError, errorMessage } from './types';
import hotel from './fixtures/recording-hotel-california.json';
import yerushalayim from './fixtures/recording-yerushalayim.json';
import arik from './fixtures/artist-arik-einstein.json';
import eaglesLookup from './fixtures/recording-lookup-eagles.json';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('נרמול טקסט ושאילתות', () => {
  it('מסיר ניקוד ומאחד גרש/גרשיים', () => {
    expect(normalizeText('שָׁלוֹם  עֲלֵיכֶם')).toBe('שלום עליכם');
    expect(normalizeText('ג׳ינג׳י')).toBe("ג'ינג'י");
    expect(normalizeText('צה״ל')).toBe('צה"ל');
  });

  it('מפתח שם שיר מתעלם מגרסאות', () => {
    expect(titleKey('Hotel California (Live)')).toBe('hotel california');
    expect(titleKey('Hotel California - 2013 Remaster')).toBe('hotel california');
    expect(titleKey('Oh! Susanna')).toBe(titleKey('Oh Susanna'));
  });

  it('בורח מתווים מיוחדים של Lucene', () => {
    expect(escapeLucene('AC/DC: (live)')).toBe('AC\\/DC\\: \\(live\\)');
    expect(tokenize('  "Hotel   California" ')).toEqual(['hotel', 'california']);
  });

  it('שאילתת "הכל" מחייבת כל מילה בשיר/אמן/שם חלופי, עם קידומת למילה האחרונה', () => {
    const q = buildRecordingQuery('beatles yesterday', 'all');
    expect(q).toContain('(recording:beatles OR artist:beatles OR alias:beatles)');
    expect(q).toContain('recording:yesterday*');
    expect(q).toContain('recording:"beatles yesterday"^4');
    expect(q.endsWith('AND video:false')).toBe(true);
  });

  it('שאילתת שיר בעברית', () => {
    const q = buildRecordingQuery('ירושלים של זהב', 'song');
    expect(q).toContain('recording:"ירושלים של זהב"^4');
    expect(q).not.toContain('artist:');
  });

  it('שאילתת אמן כוללת שמות חלופיים', () => {
    expect(buildArtistQuery('arik einstein')).toContain('alias:"arik einstein"^3');
  });

  it('סגנון בעברית מתורגם לתגיות', () => {
    expect(styleTags('רוק')).toEqual(['rock']);
    expect(styleTags('מזרחית')).toContain('mizrahi');
    expect(styleTags('Jazz')).toEqual(['jazz']);
    expect(buildRecordingQuery('רוק', 'style')).toBe('tag:("rock") AND video:false');
  });

  it('שאילתה ריקה לא נשלחת', () => {
    expect(buildRecordingQuery('   ', 'all')).toBe('');
    expect(buildArtistQuery('')).toBe('');
  });
});

describe('מיפוי ודירוג תוצאות אמיתיות (fixtures מ-MusicBrainz)', () => {
  it('Hotel California: ההקלטה של Eagles מדורגת ראשונה, בלי כפילויות', () => {
    const items = groupAndRank((hotel as any).recordings.map(mapRecording), 'hotel california');
    expect(items[0].artist).toBe('Eagles');
    const keys = items.map((s) => s.title.toLowerCase() + '|' + s.artists[0]?.id);
    expect(new Set(keys).size).toBe(keys.length);
    expect(items.length).toBeLessThan((hotel as any).recordings.length);
  });

  it('ירושלים של זהב: תוצאות בעברית, כולל ביצוע של נעמי שמר', () => {
    const items = groupAndRank((yerushalayim as any).recordings.map(mapRecording), 'ירושלים של זהב');
    expect(items.length).toBeGreaterThan(3);
    expect(items.slice(0, 5).every((s) => titleKey(s.title).includes('ירושלים של זהב'))).toBe(true);
    expect(items.some((s) => s.artist.includes('נעמי שמר'))).toBe(true);
  });

  it('אמן: חיפוש בתעתיק לטיני מוצא את השם העברי דרך שמות חלופיים', () => {
    const a = mapArtist((arik as any).artists[0]);
    expect(a.name).toBe('אריק איינשטיין');
    expect(a.aliases.some((x) => /arik einstein/i.test(x))).toBe(true);
  });

  it('פרטי שיר: כותבים מתוך יחסי היצירה', () => {
    const d = mapRecordingDetails(eaglesLookup as any);
    expect(d.title).toBe('Hotel California');
    const names = d.works.flatMap((w) => w.writers.map((x) => x.name));
    expect(names).toEqual(expect.arrayContaining(['Don Henley', 'Glenn Frey', 'Don Felder']));
    expect(d.sourceUrl).toContain(d.id);
  });

  it('מיזוג עמוד נוסף לא משכפל ולא משנה את המערך הקיים', () => {
    const items = groupAndRank((hotel as any).recordings.map(mapRecording), 'hotel california');
    const before = JSON.stringify(items);
    const merged = mergeSongs(items, items.slice(0, 3));
    expect(merged.length).toBe(items.length);
    expect(JSON.stringify(items)).toBe(before);
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('לקוח MusicBrainz: רשת, שגיאות ותור בקשות', () => {
  it('מנסה שוב כשהשרת עמוס, ומצליח', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 503))
      .mockResolvedValueOnce(jsonResponse(arik));
    const mb = new MusicBrainzCatalog(f, 0, [1]);
    const page = await mb.searchArtists('arik einstein', 0);
    expect(f).toHaveBeenCalledTimes(2);
    expect(page.items[0].name).toBe('אריק איינשטיין');
  });

  it('שגיאת רשת → CatalogError מסוג network עם הודעה בעברית', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const mb = new MusicBrainzCatalog(f, 0, []);
    const err = await mb.searchSongs('test', 'all', 0).catch((e) => e);
    expect(err).toBeInstanceOf(CatalogError);
    expect(err.kind).toBe('network');
    expect(errorMessage(err)).toContain('אין חיבור');
  });

  it('עומס מתמשך → busy; 404 → not-found', async () => {
    const busy = new MusicBrainzCatalog(vi.fn().mockResolvedValue(jsonResponse({}, 503)), 0, [1, 1]);
    expect((await busy.getArtist('x').catch((e) => e)).kind).toBe('busy');
    const nf = new MusicBrainzCatalog(vi.fn().mockResolvedValue(jsonResponse({}, 404)), 0, []);
    expect((await nf.getSong('8c198c88-9a5f-40cc-812d-39536ee6c9df').catch((e) => e)).kind).toBe('not-found');
    expect((await nf.getSong('not-an-id').catch((e) => e)).kind).toBe('not-found');
  });

  it('אין תוצאות → רשימה ריקה ואין עמוד נוסף', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ count: 0, recordings: [], artists: [] }));
    const r = await new MusicBrainzCatalog(f, 0, []).searchSongs('qwxzvbnm', 'song', 0);
    expect(r.songs.items).toEqual([]);
    expect(r.songs.nextOffset).toBeNull();
  });

  it('עמודים: nextOffset מתקדם לפי מספר התוצאות', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse(hotel));
    const r = await new MusicBrainzCatalog(f, 0, []).searchSongs('hotel california', 'song', 0);
    expect(r.songs.nextOffset).toBe((hotel as any).recordings.length);
    expect(r.songs.total).toBe((hotel as any).count);
  });

  it('מכבד מרווח בין בקשות (תור יחיד)', async () => {
    const times: number[] = [];
    const f = vi.fn(async () => {
      times.push(Date.now());
      return jsonResponse(arik);
    });
    const mb = new MusicBrainzCatalog(f, 120, []);
    await Promise.all([mb.getArtist('a'), mb.getArtist('b'), mb.getArtist('c')]);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(110);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(110);
  });

  it('ביטול בקשה לא נחשב שגיאה', async () => {
    const ctl = new AbortController();
    const f = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, rej) =>
          init?.signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError'))),
        ),
    );
    const p = new MusicBrainzCatalog(f, 0, []).getArtist('a', ctl.signal);
    ctl.abort();
    const err = await p.catch((e) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect(err.name).toBe('AbortError');
  });
});

describe('בחירת ההקלטה המייצגת', () => {
  it('ההקלטה עם הכי הרבה הוצאות מייצגת את השיר', () => {
    const base = { artist: 'Eagles', artists: [{ id: 'e', name: 'Eagles' }], tags: [], score: 100 };
    const [g] = groupAndRank([
      { ...base, id: 'live', title: 'Hotel California', versions: 1, year: '2016', lengthMs: 422000 },
      { ...base, id: 'orig', title: 'Hotel California', versions: 12, year: '1976', lengthMs: 391000 },
    ]);
    expect(g.id).toBe('orig');
    expect(g.versions).toBe(13);
    expect(g.year).toBe('1976');
  });
});
