/**
 * קישורי חיפוש באתרים חיצוניים. אלה קישורים בלבד: האתר לא מוריד, לא שומר ולא מציג תוכן מהם.
 */
const HEBREW = /[֐-׿]/;

export interface ExternalLink {
  name: string;
  url: string;
  hint: string;
}

export function externalLinks(title: string, artist: string): ExternalLink[] {
  const q = `${title} ${artist}`.trim();
  const tab4u: ExternalLink = {
    name: 'Tab4u',
    url: `https://www.tab4u.com/resultsSimple?tab=songs&q=${encodeURIComponent(title)}`,
    hint: 'אקורדים לשירים בעברית',
  };
  const ug: ExternalLink = {
    name: 'Ultimate Guitar',
    url: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`,
    hint: 'אקורדים וטאבים, בעיקר באנגלית',
  };
  const songsterr: ExternalLink = {
    name: 'Songsterr',
    url: `https://www.songsterr.com/?pattern=${encodeURIComponent(q)}`,
    hint: 'טאבים מורשים',
  };
  return HEBREW.test(q) ? [tab4u, ug] : [ug, songsterr, tab4u];
}
