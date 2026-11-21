/** פונקציות טהורות לבניית שאילתות, נרמול טקסט ודירוג תוצאות. נבדקות ביחידה. */
import type { SearchMode, SongSummary } from './types';

const NIQQUD = /[֑-ׇ]/g;

/** נרמול להשוואה: בלי ניקוד, אחידות גרש/גרשיים, אותיות קטנות, רווחים מצומצמים. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .replace(NIQQUD, '')
    .replace(/[׳`´’‘]/g, "'")
    .replace(/[״“”„]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** מפתח לאיחוד גרסאות של אותו שיר: בלי סוגריים (Live, Remastered…) ובלי סיומות אחרי מקף. */
export function titleKey(title: string): string {
  return normalizeText(title)
    .replace(/\s*[([{].*?[)\]}]/g, '')
    .replace(/\s+[-–—]\s+.*(remaster|live|version|mix|edit|גרסה|הופעה|רמיקס).*$/i, '')
    .replace(/["'.,!?]/g, '')
    .trim();
}

const LUCENE_SPECIAL = /([+\-&|!(){}[\]^"~*?:\\/])/g;

export function escapeLucene(s: string): string {
  return s.replace(LUCENE_SPECIAL, '\\$1');
}

export function tokenize(q: string): string[] {
  return normalizeText(q)
    .replace(/["]/g, ' ')
    .split(' ')
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * ביטוי לשדה עבור מילה אחת. למילה האחרונה מוסיפים גם התאמת קידומת (חיפוש תוך כדי הקלדה).
 */
function termFor(fields: string[], token: string, isLast: boolean): string {
  const t = escapeLucene(token);
  const parts = fields.map((f) => `${f}:${t}`);
  if (isLast && token.length >= 2) parts.push(...fields.map((f) => `${f}:${t}*`));
  return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
}

function allTokens(fields: string[], tokens: string[]): string {
  return tokens.map((t, i) => termFor(fields, t, i === tokens.length - 1)).join(' AND ');
}

/** סגנונות מוכרים בעברית → תגיות MusicBrainz. */
export const STYLES: { label: string; tags: string[] }[] = [
  { label: 'רוק', tags: ['rock'] },
  { label: 'פופ', tags: ['pop'] },
  { label: 'ישראלי', tags: ['israeli', 'hebrew', 'israeli pop', 'israeli rock'] },
  { label: 'מזרחית', tags: ['mizrahi', 'mizrahi music'] },
  { label: 'פולק', tags: ['folk', 'folk rock'] },
  { label: 'בלוז', tags: ['blues'] },
  { label: 'ג׳אז', tags: ['jazz'] },
  { label: 'קאנטרי', tags: ['country'] },
  { label: 'מטאל', tags: ['metal', 'heavy metal'] },
  { label: 'פאנק', tags: ['punk', 'punk rock'] },
  { label: 'היפ הופ', tags: ['hip hop', 'hip-hop'] },
  { label: 'רגאיי', tags: ['reggae'] },
  { label: 'סול', tags: ['soul'] },
  { label: 'אלקטרוני', tags: ['electronic'] },
  { label: 'קלאסי', tags: ['classical'] },
];

export function styleTags(q: string): string[] {
  const n = normalizeText(q);
  const known = STYLES.find((s) => normalizeText(s.label) === n);
  return known ? known.tags : [n];
}

function tagQuery(q: string): string {
  return `tag:(${styleTags(q)
    .map((t) => `"${escapeLucene(t)}"`)
    .join(' OR ')})`;
}

/** שאילתת הקלטות (שירים) לפי מצב החיפוש. */
export function buildRecordingQuery(q: string, mode: SearchMode): string {
  if (mode === 'style') return `${tagQuery(q)} AND video:false`;
  const tokens = tokenize(q);
  if (tokens.length === 0) return '';
  const phrase = escapeLucene(tokens.join(' '));
  let core: string;
  if (mode === 'song') {
    core = `recording:"${phrase}"^4 OR ${allTokens(['recording', 'alias'], tokens)}`;
  } else {
    // "הכל": כל מילה חייבת להופיע בשם השיר, בשם האמן או בשם חלופי – כך "beatles yesterday" עובד
    core = `recording:"${phrase}"^4 OR artist:"${phrase}"^2 OR (${allTokens(['recording', 'artist', 'alias'], tokens)})`;
  }
  return `(${core}) AND video:false`;
}

/** שאילתת אמנים (כולל שמות חלופיים ותעתיקים). */
export function buildArtistQuery(q: string, mode: SearchMode = 'artist'): string {
  if (mode === 'style') return tagQuery(q);
  const tokens = tokenize(q);
  if (tokens.length === 0) return '';
  const phrase = escapeLucene(tokens.join(' '));
  return `artist:"${phrase}"^4 OR alias:"${phrase}"^3 OR (${allTokens(['artist', 'alias', 'sortname'], tokens)})`;
}

export function artistSongsQuery(artistId: string): string {
  return `arid:${artistId} AND video:false`;
}

/** מפתח איחוד: שם שיר מנורמל + האמן הראשי. */
export function songKey(s: Pick<SongSummary, 'title' | 'artists' | 'artist'>): string {
  return titleKey(s.title) + '|' + (s.artists[0]?.id ?? normalizeText(s.artist));
}

/**
 * מאחד הקלטות כפולות של אותו שיר ואותו אמן, ומדרג:
 *  ציון ההתאמה של המאגר + בונוס לשיר שיש לו הרבה גרסאות (קירוב לפופולריות)
 *  + בונוס להתאמה מדויקת של שם השיר / האמן לשאילתה.
 */
export function groupAndRank(items: SongSummary[], q = ''): SongSummary[] {
  const groups = new Map<string, SongSummary>();
  // כמה הוצאות יש להקלטה המייצגת עצמה – כדי שהמייצגת תהיה ההקלטה הנפוצה (המקורית), ולא הופעה חיה נדירה
  const repVersions = new Map<string, number>();
  for (const it of items) {
    const k = songKey(it);
    const g = groups.get(k);
    if (!g) {
      groups.set(k, { ...it, tags: [...it.tags] });
      repVersions.set(k, it.versions);
      continue;
    }
    g.versions += it.versions;
    g.score = Math.max(g.score, it.score);
    if (it.year && (!g.year || it.year < g.year)) g.year = it.year;
    for (const t of it.tags) if (!g.tags.includes(t)) g.tags.push(t);
    const rv = repVersions.get(k)!;
    if (it.versions > rv || (it.versions === rv && it.title.length < g.title.length)) {
      g.id = it.id;
      g.title = it.title;
      g.lengthMs = it.lengthMs;
      g.disambiguation = it.disambiguation;
      repVersions.set(k, it.versions);
    }
  }
  const nq = normalizeText(q);
  const tokens = tokenize(q);
  const rank = (s: SongSummary) => {
    let r = s.score + 6 * Math.log2(1 + s.versions);
    const t = titleKey(s.title);
    if (nq && t === titleKey(q)) r += 15;
    else if (
      nq &&
      tokens.length > 1 &&
      tokens.every((x) => t.includes(x) || normalizeText(s.artist).includes(x))
    )
      r += 10;
    return r;
  };
  return [...groups.values()].sort((a, b) => rank(b) - rank(a));
}

/** מוסיף עמוד נוסף של תוצאות בלי לשבור את הסדר הקיים ובלי כפילויות. */
export function mergeSongs(existing: SongSummary[], incoming: SongSummary[]): SongSummary[] {
  const out = existing.map((s) => ({ ...s }));
  const byKey = new Map(out.map((s) => [songKey(s), s]));
  for (const s of incoming) {
    const k = songKey(s);
    const prev = byKey.get(k);
    if (prev) {
      prev.versions += s.versions;
      continue;
    }
    byKey.set(k, s);
    out.push(s);
  }
  return out;
}
