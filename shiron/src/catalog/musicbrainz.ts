/**
 * ספק קטלוג: MusicBrainz (https://musicbrainz.org/doc/MusicBrainz_API).
 * נתונים פתוחים (CC0 לנתוני הליבה), תומך CORS – הדפדפן פונה ישירות, בלי שרת ביניים.
 *
 * כללי השימוש של MusicBrainz: עד בקשה אחת בשנייה. לכן כל הבקשות עוברות בתור אחד,
 * עם מטמון בזיכרון, וניסיון חוזר כשהשרת עונה "עמוס" (503).
 */
import {
  CatalogError,
  type ArtistSummary,
  type CatalogProvider,
  type Page,
  type SearchMode,
  type SongDetails,
  type SongSearchResult,
  type SongSummary,
  type Writer,
} from './types';
import { artistSongsQuery, buildArtistQuery, buildRecordingQuery, groupAndRank } from './query';

const BASE = 'https://musicbrainz.org/ws/2/';
const MIN_INTERVAL_MS = 1100;
const RETRY_DELAYS = [1500, 3000, 6000];
const SONG_PAGE = 50;
const VARIOUS_ARTISTS = '89ad4ac3-39f7-470e-963a-56509c546377';
const ARTIST_SONG_PAGE = 100;

/* ---------- טיפוסי JSON חלקיים של MusicBrainz ---------- */
interface MbTag {
  name: string;
  count?: number;
}
interface MbArtistCredit {
  name: string;
  joinphrase?: string;
  artist: { id: string; name: string };
}
interface MbRecording {
  id: string;
  title: string;
  score?: number;
  length?: number | null;
  disambiguation?: string;
  'first-release-date'?: string;
  'artist-credit'?: MbArtistCredit[];
  tags?: MbTag[];
  genres?: MbTag[];
  releases?: { id: string; title: string; date?: string }[];
  isrcs?: string[];
  relations?: MbRelation[];
}
interface MbRelation {
  type: string;
  'target-type'?: string;
  work?: { id: string; title: string; relations?: MbRelation[] };
  artist?: { id: string; name: string };
}
interface MbArtist {
  id: string;
  name: string;
  'sort-name'?: string;
  score?: number;
  disambiguation?: string;
  country?: string;
  type?: string;
  aliases?: { name: string }[];
  tags?: MbTag[];
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

/* ---------- ממפים ---------- */
function topTags(tags?: MbTag[], genres?: MbTag[], n = 4): string[] {
  const all = [...(genres ?? []), ...(tags ?? [])].filter((t) => (t.count ?? 1) > 0);
  all.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  return [...new Set(all.map((t) => t.name))].slice(0, n);
}

function creditName(ac?: MbArtistCredit[]): string {
  if (!ac?.length) return 'אמן לא ידוע';
  return ac
    .map((c) => c.name + (c.joinphrase ?? ''))
    .join('')
    .trim();
}

export function mapRecording(r: MbRecording): SongSummary {
  return {
    id: r.id,
    title: r.title,
    artist: creditName(r['artist-credit']),
    artists: (r['artist-credit'] ?? []).map((c) => ({ id: c.artist.id, name: c.artist.name })),
    year: r['first-release-date']?.slice(0, 4) || undefined,
    lengthMs: r.length ?? undefined,
    tags: topTags(r.tags, r.genres),
    disambiguation: r.disambiguation || undefined,
    versions: Math.max(1, r.releases?.length ?? 1),
    score: r.score ?? 100,
  };
}

export function mapArtist(a: MbArtist): ArtistSummary {
  const aliases = [...new Set((a.aliases ?? []).map((x) => x.name))].filter((n) => n !== a.name);
  return {
    id: a.id,
    name: a.name,
    sortName: a['sort-name'],
    aliases,
    disambiguation: a.disambiguation || undefined,
    country: a.country,
    type: a.type,
    tags: topTags(a.tags),
    score: a.score ?? 100,
  };
}

const WRITER_ROLES: Record<string, Writer['role']> = {
  composer: 'composer',
  lyricist: 'lyricist',
  writer: 'writer',
  arranger: 'arranger',
  translator: 'translator',
};

export function mapRecordingDetails(r: MbRecording): SongDetails {
  const base = mapRecording(r);
  const works = (r.relations ?? [])
    .filter((rel) => rel.work)
    .map((rel) => ({
      id: rel.work!.id,
      title: rel.work!.title,
      writers: (rel.work!.relations ?? [])
        .filter((wr) => wr.artist && WRITER_ROLES[wr.type])
        .map((wr) => ({ name: wr.artist!.name, role: WRITER_ROLES[wr.type] })),
    }));
  const releases = (r.releases ?? []).map((x) => ({ id: x.id, title: x.title, date: x.date }));
  return {
    ...base,
    works,
    releases,
    isrcs: r.isrcs ?? [],
    sourceUrl: `https://musicbrainz.org/recording/${r.id}`,
  };
}

/* ---------- הלקוח ---------- */
export class MusicBrainzCatalog implements CatalogProvider {
  readonly name = 'MusicBrainz';
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequest = 0;
  private cache = new Map<string, unknown>();

  constructor(
    private fetchImpl: FetchLike = (...a) => fetch(...a),
    private interval = MIN_INTERVAL_MS,
    private retryDelays = RETRY_DELAYS,
  ) {}

  /** בקשה אחת בכל פעם, במרווח של לפחות `interval`. */
  private schedule<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const run = async () => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const wait = this.lastRequest + this.interval - Date.now();
      if (wait > 0) await sleep(wait, signal);
      this.lastRequest = Date.now();
      return task();
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  async request<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const url = BASE + path + '?' + new URLSearchParams({ ...params, fmt: 'json' }).toString();
    if (this.cache.has(url)) return this.cache.get(url) as T;

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.schedule(
          () => this.fetchImpl(url, { signal, headers: { Accept: 'application/json' } }),
          signal,
        );
      } catch (e) {
        if (isAbort(e) || signal?.aborted) throw e;
        throw new CatalogError('network', String(e));
      }
      if (res.ok) {
        const data = (await res.json()) as T;
        if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(url, data);
        return data;
      }
      if ((res.status === 503 || res.status === 429) && attempt < this.retryDelays.length) {
        await sleep(this.retryDelays[attempt], signal);
        continue;
      }
      if (res.status === 503 || res.status === 429) throw new CatalogError('busy', `HTTP ${res.status}`);
      if (res.status === 404) throw new CatalogError('not-found', 'HTTP 404');
      if (res.status === 400) throw new CatalogError('bad-request', 'HTTP 400');
      throw new CatalogError('server', `HTTP ${res.status}`);
    }
  }

  async searchSongs(
    q: string,
    mode: SearchMode,
    offset: number,
    signal?: AbortSignal,
  ): Promise<SongSearchResult> {
    const query = buildRecordingQuery(q, mode);
    if (!query) return { songs: { items: [], total: 0, nextOffset: null }, artists: [] };

    const data = await this.request<{ count: number; recordings: MbRecording[] }>(
      'recording',
      { query, limit: String(SONG_PAGE), offset: String(offset) },
      signal,
    );
    const items = groupAndRank(data.recordings.map(mapRecording), mode === 'style' ? '' : q);
    const next = offset + data.recordings.length;

    let artists: ArtistSummary[] = [];
    if (offset === 0 && (mode === 'all' || mode === 'style')) {
      try {
        const a = await this.searchArtists(q, 0, signal, mode, 6);
        artists = mode === 'all' ? a.items.filter((x) => x.score >= 90).slice(0, 3) : a.items;
      } catch (e) {
        if (isAbort(e)) throw e;
        // רשימת האמנים היא תוספת – אם נכשלה, עדיין מציגים את השירים
      }
    }
    return {
      songs: {
        items,
        total: data.count,
        nextOffset: next < data.count && data.recordings.length ? next : null,
      },
      artists,
    };
  }

  async searchArtists(
    q: string,
    offset: number,
    signal?: AbortSignal,
    mode: SearchMode = 'artist',
    limit = 25,
  ): Promise<Page<ArtistSummary>> {
    const query = buildArtistQuery(q, mode);
    if (!query) return { items: [], total: 0, nextOffset: null };
    const data = await this.request<{ count: number; artists: MbArtist[] }>(
      'artist',
      { query, limit: String(limit), offset: String(offset) },
      signal,
    );
    const next = offset + data.artists.length;
    return {
      // "Various Artists" הוא ערך מיוחד במאגר (אוספים), לא אמן אמיתי
      items: data.artists.filter((a) => a.id !== VARIOUS_ARTISTS).map(mapArtist),
      total: data.count,
      nextOffset: next < data.count && data.artists.length ? next : null,
    };
  }

  async getArtist(id: string, signal?: AbortSignal): Promise<ArtistSummary> {
    const a = await this.request<MbArtist>(
      `artist/${encodeURIComponent(id)}`,
      { inc: 'aliases+tags' },
      signal,
    );
    return mapArtist(a);
  }

  async artistSongs(id: string, offset: number, signal?: AbortSignal): Promise<Page<SongSummary>> {
    const data = await this.request<{ count: number; recordings: MbRecording[] }>(
      'recording',
      { query: artistSongsQuery(id), limit: String(ARTIST_SONG_PAGE), offset: String(offset) },
      signal,
    );
    const next = offset + data.recordings.length;
    return {
      items: groupAndRank(data.recordings.map(mapRecording)),
      total: data.count,
      nextOffset: next < data.count && data.recordings.length ? next : null,
    };
  }

  async getSong(id: string, signal?: AbortSignal): Promise<SongDetails> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new CatalogError('not-found', 'invalid id');
    const r = await this.request<MbRecording>(
      `recording/${id}`,
      { inc: 'artist-credits+releases+tags+genres+isrcs+work-rels+work-level-rels+artist-rels' },
      signal,
    );
    return mapRecordingDetails(r);
  }
}

export const catalog: CatalogProvider = new MusicBrainzCatalog();
