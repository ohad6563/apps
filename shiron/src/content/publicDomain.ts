/**
 * ספק תוכן: שירים בנחלת הכלל.
 *
 * מילים שזכויות היוצרים עליהן פקעו (או מסורתיות), עם עיבוד אקורדים בסיסי של השירון.
 * ההתאמה לקטלוג היא לפי שם השיר (ושמות חלופיים) – כי זה השיר עצמו, בלי קשר למבצע.
 * זה מקור תוכן אמיתי אבל מצומצם. הוא לא מחליף ספק אקורדים מורשה (ראו docs/content-providers.md).
 */
import { titleKey } from '../catalog/query';
import { parseSongText } from '../lib/parse';
import type { ChordProvider, ChordSheet, SongRef } from './types';

interface PdSong {
  id: string;
  titles: string[];
  title: string;
  artist: string;
  key: string;
  difficulty: ChordSheet['difficulty'];
  basis: string;
  text: string;
}

const LIBRARY: PdSong[] = [
  {
    id: 'amazing-grace',
    titles: ['Amazing Grace'],
    title: 'Amazing Grace',
    artist: 'John Newton (1779), לחן מסורתי',
    key: 'G',
    difficulty: 'easy',
    basis: 'מילים: ג׳ון ניוטון, 1779. לחן: מסורתי (New Britain). נחלת הכלל.',
    text: `
{בית 1}
A[G]mazing [G7]grace! How [C]sweet the [G]sound
That saved a wretch like [D]me! [D7]
I [G]once was [G7]lost, but [C]now am [G]found;
Was [Em]blind, but [D]now I [G]see.

{בית 2}
'Twas [G]grace that [G7]taught my [C]heart to [G]fear,
And grace my fears re[D]lieved; [D7]
How [G]precious [G7]did that [C]grace ap[G]pear
The [Em]hour I [D]first be[G]lieved.

{בית 3}
Through [G]many [G7]dangers, [C]toils and [G]snares,
I have already [D]come; [D7]
'Tis [G]grace hath [G7]brought me [C]safe thus [G]far,
And [Em]grace will [D]lead me [G]home.
`,
  },
  {
    id: 'oh-susanna',
    titles: ['Oh! Susanna', 'Oh Susanna', 'Oh, Susanna'],
    title: 'Oh! Susanna',
    artist: 'Stephen Foster (1848)',
    key: 'C',
    difficulty: 'easy',
    basis: 'מילים ולחן: סטיבן פוסטר, 1848. נחלת הכלל.',
    text: `
{בית 1}
I [C]come from Alabama with my [G7]banjo on my knee,
I'm [C]goin' to Louisiana, my [G7]true love for to [C]see.
It [C]rained all night the day I left, the [G7]weather it was dry,
The [C]sun so hot I froze to death; Su[G7]sanna, don't you [C]cry.

{פזמון}
[F]Oh, Susanna, oh [C]don't you cry for [G7]me,
For I [C]come from Alabama with my [G7]banjo on my [C]knee.
`,
  },
  {
    id: 'red-river-valley',
    titles: ['Red River Valley', 'The Red River Valley'],
    title: 'Red River Valley',
    artist: 'שיר עם אמריקאי מסורתי',
    key: 'G',
    difficulty: 'easy',
    basis: 'שיר עם מסורתי מהמאה ה-19. נחלת הכלל.',
    text: `
{בית 1}
From this [G]valley they say you are [D7]going,
We will miss your bright eyes and sweet [G]smile,
For they say you are taking the [C]sunshine
That has [G]brightened our [D7]pathway a [G]while.

{פזמון}
[G]Come and sit by my side if you [D7]love me,
Do not hasten to bid me a[G]dieu,
But re[G7]member the Red River [C]Valley,
And the [G]cowboy who [D7]loved you so [G]true.
`,
  },
  {
    id: 'auld-lang-syne',
    titles: ['Auld Lang Syne'],
    title: 'Auld Lang Syne',
    artist: 'Robert Burns (1788), לחן מסורתי',
    key: 'G',
    difficulty: 'easy',
    basis: 'מילים: רוברט ברנס, 1788. לחן: סקוטי מסורתי. נחלת הכלל.',
    text: `
{בית 1}
Should [G]auld acquaintance be for[D7]got,
And [G]never brought to [C]mind?
Should [G]auld acquaintance be for[D7]got,
And [Em]auld [C]lang [D7]syne? [G]

{פזמון}
For [G]auld lang syne, my jo,
For [D7]auld lang syne,
We'll [G]tak a cup o' kindness [C]yet,
For [Em]auld [C]lang [D7]syne. [G]
`,
  },
  {
    id: 'swing-low',
    titles: ['Swing Low, Sweet Chariot', 'Swing Low Sweet Chariot', 'Swing Low'],
    title: 'Swing Low, Sweet Chariot',
    artist: 'ספיריטואל אפרו-אמריקאי מסורתי',
    key: 'G',
    difficulty: 'easy',
    basis: 'ספיריטואל מסורתי מהמאה ה-19. נחלת הכלל.',
    text: `
{פזמון}
[G]Swing low, sweet [C]chari[G]ot,
Comin' for to carry me [D7]home,
[G]Swing low, sweet [C]chari[G]ot,
Comin' for to [D7]carry me [G]home.

{בית 1}
I [G]looked over Jordan, and [C]what did I [G]see,
Comin' for to carry me [D7]home?
A [G]band of angels [C]comin' after [G]me,
Comin' for to [D7]carry me [G]home.
`,
  },
  {
    id: 'hava-nagila',
    titles: ['הבה נגילה', 'Hava Nagila', 'Hava Nagilah', 'Havah Nagilah', 'Hava Nageela'],
    title: 'הבה נגילה',
    artist: 'א״צ אידלסון (1918), לחן חסידי מסורתי',
    key: 'Am',
    difficulty: 'easy',
    basis: 'מילים: אברהם צבי אידלסון (נפטר ב-1938). לחן: ניגון חסידי מסורתי. נחלת הכלל.',
    text: `
{בית 1}
[E]הבה נגילה, הבה נגילה, הבה נגילה ונשמחה
[E]הבה נגילה, הבה נגילה, הבה נגילה ונשמחה

{בית 2}
[Dm]הבה נרננה, הבה נרננה, הבה נרננה ונשמ[E]חה
[Dm]הבה נרננה, הבה נרננה, הבה נרננה ונשמ[E]חה

{פזמון}
[Am]עורו, עורו אחים, עורו אחים בלב [E]שמח
[Am]עורו, עורו אחים, עורו אחים בלב [E]שמח
[Am]עורו אחים, [Dm]עורו אחים, [E]בלב שמ[Am]ח
`,
  },
];

const INDEX = new Map<string, PdSong>();
for (const s of LIBRARY) for (const t of s.titles) INDEX.set(titleKey(t), s);

function lookup(title: string): PdSong | undefined {
  return INDEX.get(titleKey(title));
}

function toSheet(s: PdSong): ChordSheet {
  return {
    id: `pd:${s.id}`,
    title: s.title,
    artist: s.artist,
    key: s.key,
    difficulty: s.difficulty,
    scrollSpeed: 3,
    sections: parseSongText(s.text),
    source: {
      providerId: 'public-domain',
      name: 'נחלת הכלל – עיבוד השירון',
      license: s.basis,
    },
    note: 'זו גרסת נחלת הכלל של השיר עם אקורדים בסיסיים. ייתכן שהביצוע שבחרתם שונה במילים או בסולם.',
  };
}

export const publicDomainProvider: ChordProvider = {
  id: 'public-domain',
  name: 'נחלת הכלל',
  description: `שירים שזכויות היוצרים עליהם פקעו או מסורתיים, עם עיבוד אקורדים בסיסי של השירון (${LIBRARY.length} שירים).`,
  isEnabled: () => true,
  quickCheck: (ref) => Boolean(lookup(ref.title)),
  async find(ref: SongRef) {
    const s = lookup(ref.title);
    return s ? [toSheet(s)] : [];
  },
};

export const PUBLIC_DOMAIN_TITLES = LIBRARY.map((s) => s.title);
