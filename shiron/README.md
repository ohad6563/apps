# שירון אקורדים

חיפוש שירים ואמנים בעברית ובאנגלית מול קטלוג אמיתי (MusicBrainz), עם תצוגת מילים ואקורדים מעליהן כשיש מקור תוכן מורשה.

## הרצה

```bash
npm install
npm run dev         # פיתוח
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # בדיקות יחידה (Vitest), כולל fixtures אמיתיים מ-MusicBrainz
npm run build       # בניית production ל-dist/
npm run e2e         # בדיקות דפדפן מול ה-build ומול MusicBrainz האמיתי
```

האתר סטטי לגמרי: הדפדפן פונה ישירות ל-MusicBrainz (שמאפשר CORS). אפשר לארח את `dist/` בכל אחסון סטטי (GitHub Pages, Netlify, Cloudflare Pages).

## ארכיטקטורה

```
src/
  catalog/            שכבת הקטלוג – מה קיים בעולם
    types.ts            מבנה אחיד: SongSummary, SongDetails, ArtistSummary, CatalogProvider
    query.ts            בניית שאילתות, נרמול עברית, איחוד כפילויות ודירוג
    musicbrainz.ts      ספק MusicBrainz: תור בקשות (1 בשנייה), מטמון, ניסיון חוזר, שגיאות
  content/            שכבת התוכן – אקורדים, נפרדת מהקטלוג
    types.ts            ChordSheet, ChordProvider, SongRef
    registry.ts         רשימת הספקים; findSheets() מריץ את כולם במקביל
    userSheets.ts       גיליונות אישיים (בדפדפן בלבד)
    publicDomain.ts     שירים בנחלת הכלל
    remoteApi.ts        חיבור ל-API מורשה (VITE_CHORDS_API_URL)
    externalLinks.ts    קישורי חיפוש חיצוניים (קישורים בלבד)
  lib/                מודל המילים והאקורדים, פענוח, פריסה, העברת סולם
  components/         חיפוש, עמוד אמן, עמוד שיר, עורך, מקורות
```

**כתובות:** `#/?q=…&mode=…` (חיפוש), `#/song/<recording-mbid>`, `#/artist/<artist-mbid>`, `#/sources`.

## חיפוש

- מצבים: הכל / שם שיר / אמן / סגנון. במצב "הכל" כל מילה צריכה להופיע בשם השיר, בשם האמן או בשם חלופי, כך ש-"beatles yesterday" עובד.
- חיפוש בזמן הקלדה (debounce של 450ms) עם ביטול בקשות ישנות.
- שמות חלופיים ותעתיקים: "arik einstein" מוצא את אריק איינשטיין.
- איחוד גרסאות כפולות של אותו שיר ואותו אמן, ודירוג לפי ציון ההתאמה ומספר הגרסאות. כך ההקלטה המקורית עולה מעל גרסאות כיסוי.
- טעינת תוצאות נוספות, הודעה כשאין תוצאות, הודעות שגיאה ברורות (אין רשת, השרת עמוס), וכפתור "נסו שוב".

## אקורדים

האתר **לא** ממציא אקורדים ולא מעתיק מאתרים אחרים. כשאין מקור מורשה, עמוד השיר מציג:
„מצאנו את השיר, אבל עדיין אין אקורדים זמינים להצגה.”
ואחרי ההודעה: הוספת גיליון אישי, שמירה במועדפים וקישורי חיפוש חיצוניים.

**מה חסר לכיסוי רחב, ואיך מחברים מאגר מורשה:** [docs/content-providers.md](docs/content-providers.md)
