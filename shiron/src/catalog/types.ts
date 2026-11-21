/**
 * שכבת הקטלוג: מידע על שירים ואמנים (שם, אמן, שנה, סגנון).
 * הקטלוג נפרד לגמרי מתוכן האקורדים – שיר יכול להופיע בקטלוג גם כשאין לו אקורדים.
 */

export type SearchMode = 'all' | 'song' | 'artist' | 'style';

export interface ArtistRef {
  id: string;
  name: string;
}

/** שיר כפי שמופיע ברשימת תוצאות. */
export interface SongSummary {
  /** מזהה ההקלטה במקור הקטלוג (MusicBrainz recording MBID). */
  id: string;
  title: string;
  artist: string;
  artists: ArtistRef[];
  year?: string;
  lengthMs?: number;
  tags: string[];
  disambiguation?: string;
  /** כמה הקלטות/הוצאות אוחדו לתוצאה זו (משמש לדירוג פופולריות). */
  versions: number;
  score: number;
}

export interface ArtistSummary {
  id: string;
  name: string;
  sortName?: string;
  /** שמות חלופיים (תעתיק, שם באנגלית וכו'). */
  aliases: string[];
  disambiguation?: string;
  country?: string;
  type?: string;
  tags: string[];
  score: number;
}

export interface Writer {
  name: string;
  role: 'composer' | 'lyricist' | 'writer' | 'arranger' | 'translator';
}

export interface WorkRef {
  id: string;
  title: string;
  writers: Writer[];
}

/** פרטי שיר מלאים לעמוד השיר. */
export interface SongDetails extends SongSummary {
  works: WorkRef[];
  releases: { id: string; title: string; date?: string }[];
  isrcs: string[];
  sourceUrl: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  /** offset לבקשת העמוד הבא, או null אם אין עוד. */
  nextOffset: number | null;
}

export interface SongSearchResult {
  songs: Page<SongSummary>;
  /** אמנים רלוונטיים (במצב "הכל" ו"סגנון"). */
  artists: ArtistSummary[];
}

/** ממשק לכל ספק קטלוג. כרגע MusicBrainz; אפשר להוסיף ספקים נוספים בלי לשנות את הממשק. */
export interface CatalogProvider {
  readonly name: string;
  searchSongs(q: string, mode: SearchMode, offset: number, signal?: AbortSignal): Promise<SongSearchResult>;
  searchArtists(q: string, offset: number, signal?: AbortSignal): Promise<Page<ArtistSummary>>;
  getArtist(id: string, signal?: AbortSignal): Promise<ArtistSummary>;
  artistSongs(id: string, offset: number, signal?: AbortSignal): Promise<Page<SongSummary>>;
  getSong(id: string, signal?: AbortSignal): Promise<SongDetails>;
}

export class CatalogError extends Error {
  constructor(
    public kind: 'network' | 'busy' | 'not-found' | 'bad-request' | 'server',
    message: string,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof CatalogError) {
    switch (e.kind) {
      case 'network':
        return 'אין חיבור למאגר השירים. בדקו את החיבור לאינטרנט ונסו שוב.';
      case 'busy':
        return 'מאגר השירים עמוס כרגע. נסו שוב בעוד כמה שניות.';
      case 'not-found':
        return 'לא מצאנו את השיר הזה במאגר.';
      case 'bad-request':
        return 'החיפוש לא הובן. נסו לנסח אותו אחרת.';
      default:
        return 'אירעה תקלה במאגר השירים. נסו שוב מאוחר יותר.';
    }
  }
  return 'אירעה תקלה לא צפויה. נסו שוב.';
}
