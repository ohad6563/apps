// בדיקות קצה-לקצה בדפדפן אמיתי (Chromium) מול build ה-production ומול MusicBrainz האמיתי.
// הרצה: npm run build && npm run e2e
// (בסביבה עם proxy יוצא, Chromium משתמש ב-HTTPS_PROXY.)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS_DIR || 'e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'pipe',
});
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('preview server timeout')), 20000);
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t);
      res();
    }
  });
});

let failures = 0;
let passes = 0;
function check(cond, msg) {
  if (cond) passes++;
  else {
    failures++;
    console.error('  ✗ ' + msg);
  }
  return cond;
}
async function step(name, fn) {
  console.log('• ' + name);
  try {
    await fn();
  } catch (e) {
    check(false, `${name}: ${e.message.split('\n')[0]}`);
  }
}

const PHONE = { width: 360, height: 780 };
const DESKTOP = { width: 1366, height: 900 };
const NET_TIMEOUT = 45000; // MusicBrainz מגביל קצב; האפליקציה מנסה שוב כשהוא עמוס

async function measureAlignment(page) {
  return page.evaluate(() => {
    const res = { checked: 0, bad: [], overlaps: [], above: [] };
    document.querySelectorAll('.seg').forEach((seg) => {
      const chord = seg.querySelector('.chord');
      const lyric = seg.querySelector('.lyric');
      if (!chord || !chord.textContent || !lyric) return;
      const textNode = lyric.firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 1);
      const ch = range.getBoundingClientRect();
      const cr = chord.getBoundingClientRect();
      res.checked++;
      // תחילת הקטע: הקצה הימני בעברית, הקצה השמאלי ברצף אנגלי
      const ltr = getComputedStyle(seg).direction === 'ltr';
      const diff = ltr ? Math.abs(cr.left - ch.left) : Math.abs(cr.right - ch.right);
      if (diff > 1.5) res.bad.push(`${chord.textContent}@"${lyric.textContent}" Δ=${diff.toFixed(2)}`);
      if (cr.bottom > ch.top + 2) res.above.push(`${chord.textContent}@"${lyric.textContent}"`);
    });
    // אקורדים סמוכים באותה שורה ויזואלית לא חופפים
    document.querySelectorAll('.line').forEach((line) => {
      const rects = [...line.querySelectorAll('.chord')]
        .filter((c) => c.textContent)
        .map((c) => {
          const r = c.getBoundingClientRect();
          // רוחב הטקסט עצמו, בלי הריפוד
          const cs = getComputedStyle(c);
          return {
            l: r.left + parseFloat(cs.paddingLeft),
            r: r.right - parseFloat(cs.paddingRight),
            t: Math.round(r.top),
            name: c.textContent,
          };
        });
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          if (Math.abs(a.t - b.t) > 2) continue;
          if (a.l < b.r - 0.5 && b.l < a.r - 0.5) res.overlaps.push(`${a.name}/${b.name}`);
        }
    });
    return res;
  });
}


async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0);
}

async function search(page, text, mode) {
  await page.goto(BASE + '#/' + (mode ? `?mode=${mode}` : ''));
  await page.fill('#search-input', text);
  await page.waitForSelector('.song-item, .artist-item, .notice', { timeout: NET_TIMEOUT });
}

const proxy = process.env.HTTPS_PROXY
  ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }
  : undefined;
const browser = await chromium.launch({ proxy });
const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, locale: 'he-IL' });
const page = await ctx.newPage();
const mbRequests = [];
page.on('request', (r) => {
  if (r.url().startsWith('https://musicbrainz.org/')) mbRequests.push(r.url());
});

try {
  await step('1. חיפוש שיר בעברית: ירושלים של זהב', async () => {
    mbRequests.length = 0;
    await page.goto(BASE + '#/');
    // הקלדה תו-תו: ה-debounce צריך לשלוח בקשת שירים אחת בלבד
    await page.locator('#search-input').pressSequentially('ירושלים של זהב', { delay: 60 });
    await page.waitForSelector('.song-item', { timeout: NET_TIMEOUT });
    const recordingCalls = mbRequests.filter((u) => u.includes('/ws/2/recording?'));
    check(recordingCalls.length === 1, `debounce: ${recordingCalls.length} בקשות שירים במקום 1`);
    const titles = await page.locator('.song-item-title').allInnerTexts();
    const artists = await page.locator('.song-item-artist').allInnerTexts();
    check(titles.length >= 3, `מעט תוצאות: ${titles.length}`);
    check(titles.slice(0, 3).every((t) => t.includes('ירושלים של זהב')), 'תוצאות ראשונות: ' + titles.slice(0, 3));
    check(artists.some((a) => a.includes('נעמי שמר') || a.includes('שולי נתן')), 'אין ביצוע מוכר: ' + artists.slice(0, 6));
    check(page.url().includes('?q='), 'החיפוש נשמר בכתובת: ' + page.url());
    check(await noHorizontalOverflow(page), 'גלילה אופקית בתוצאות');
    check((await page.evaluate(() => document.documentElement.dir)) === 'rtl', 'dir=rtl');
    await page.screenshot({ path: `${SHOTS}/search-hebrew-phone.png` });
  });

  await step('2. חיפוש שיר באנגלית: hotel california', async () => {
    await search(page, 'hotel california');
    const first = await page.locator('.song-item').first().innerText();
    check(/Hotel California/i.test(first) && first.includes('Eagles'), 'תוצאה ראשונה: ' + first.replace(/\n/g, ' | '));
    await page.screenshot({ path: `${SHOTS}/search-english-phone.png` });
  });

  await step('2b. שיר + אמן בשאילתה אחת: beatles yesterday', async () => {
    await search(page, 'beatles yesterday');
    const items = await page.locator('.song-item').allInnerTexts();
    check(items.slice(0, 5).some((t) => /Yesterday/i.test(t) && t.includes('The Beatles')), 'אין Yesterday של הביטלס בחמש הראשונות');
  });

  await step('3. חיפוש לפי אמן בתעתיק לטיני → אמן עברי → עמוד אמן', async () => {
    await search(page, 'arik einstein', 'artist');
    const names = await page.locator('.artist-item .song-item-title').allInnerTexts();
    check(names[0] === 'אריק איינשטיין', 'אמן ראשון: ' + names[0]);
    await page.locator('.artist-item').first().click();
    await page.waitForSelector('.song-item', { timeout: NET_TIMEOUT });
    check(/#\/artist\/[0-9a-f-]{36}$/.test(page.url()), 'כתובת עמוד אמן: ' + page.url());
    const n = await page.locator('.song-item').count();
    check(n >= 10, `מעט שירים לאמן: ${n}`);
    await page.screenshot({ path: `${SHOTS}/artist-phone.png` });
    // טעינת שירים נוספים
    const more = page.getByRole('button', { name: 'שירים נוספים' });
    if (await more.count()) {
      await more.click();
      await page.waitForFunction((c) => document.querySelectorAll('.song-item').length > c, n, { timeout: NET_TIMEOUT });
      check((await page.locator('.song-item').count()) > n, 'טעינת שירים נוספים');
    }
  });

  await step('3b. חיפוש לפי סגנון: רוק', async () => {
    await page.goto(BASE + '#/?mode=style');
    await page.getByRole('button', { name: 'רוק', exact: true }).click();
    await page.waitForSelector('.song-item', { timeout: NET_TIMEOUT });
    check((await page.locator('.song-item').count()) > 5, 'תוצאות לסגנון');
    check((await page.locator('.chip.on').innerText()) === 'רוק', 'הסגנון מסומן');
  });

  await step('3c. טעינת תוצאות נוספות', async () => {
    await search(page, 'love');
    const n = await page.locator('.song-item').count();
    await page.getByRole('button', { name: 'טעינת תוצאות נוספות' }).click();
    await page.waitForFunction((c) => document.querySelectorAll('.song-item').length > c, n, { timeout: NET_TIMEOUT });
    check((await page.locator('.song-item').count()) > n, 'נוספו תוצאות');
  });

  await step('4. חיפוש שיר שאינו קיים', async () => {
    await search(page, 'qzxwvjk plorptzz');
    const t = await page.locator('.results').innerText();
    check(t.includes('לא מצאנו תוצאות'), 'הודעת אין תוצאות: ' + t.slice(0, 80));
    check((await page.locator('.song-item').count()) === 0, 'אין תוצאות מזויפות');
  });

  await step('5. שגיאת רשת', async () => {
    await page.route('https://musicbrainz.org/**', (r) => r.abort('internetdisconnected'));
    await search(page, 'shalom chanoch');
    const t = await page.locator('[role=alert]').innerText();
    check(t.includes('אין חיבור למאגר'), 'הודעת שגיאה: ' + t);
    await page.screenshot({ path: `${SHOTS}/network-error-phone.png` });
    await page.unroute('https://musicbrainz.org/**');
    await page.getByRole('button', { name: 'נסו שוב' }).click();
    await page.waitForSelector('.song-item, .artist-item', { timeout: NET_TIMEOUT });
    check(true, '');
  });

  await step('5b. שרת עמוס (503) קבוע', async () => {
    await page.route('https://musicbrainz.org/**', (r) =>
      r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"busy"}' }),
    );
    await search(page, 'busy test song');
    await page.waitForSelector('[role=alert]', { timeout: 20000 });
    check((await page.locator('[role=alert]').innerText()).includes('עמוס'), 'הודעת עומס');
    await page.unroute('https://musicbrainz.org/**');
  });

  await step('6+8. פתיחת תוצאה (Hotel California) והודעה כשאין אקורדים', async () => {
    await search(page, 'hotel california');
    await page.locator('.song-item').first().click();
    await page.waitForSelector('.no-chords, .sheet', { timeout: NET_TIMEOUT });
    check(/#\/song\/[0-9a-f-]{36}$/.test(page.url()), 'כתובת ייחודית לשיר: ' + page.url());
    check((await page.locator('.song-title').innerText()) === 'Hotel California', 'כותרת');
    check((await page.locator('.writers').innerText()).includes('Don Henley'), 'כותבים מהקטלוג');
    const msg = await page.locator('.no-chords h2').innerText();
    check(msg === 'מצאנו את השיר, אבל עדיין אין אקורדים זמינים להצגה.', 'הודעה: ' + msg);
    check((await page.locator('.chord').count()) === 0, 'אין אקורדים מומצאים');
    check((await page.locator('.external-links a').count()) >= 2, 'קישורים חיצוניים');
    check(await noHorizontalOverflow(page), 'גלילה אופקית בעמוד שיר');
    await page.screenshot({ path: `${SHOTS}/song-no-chords-phone.png`, fullPage: true });
    // חזרה לתוצאות
    await page.locator('.back-link').click();
    await page.waitForSelector('.song-item');
    check((await page.inputValue('#search-input')) === 'hotel california', 'חזרה לתוצאות החיפוש');
  });

  await step('7. הצגת תוכן אקורדים זמין (Amazing Grace, נחלת הכלל)', async () => {
    await search(page, 'amazing grace', 'song');
    const withBadge = page.locator('.song-item', { has: page.locator('.badge--chords') }).first();
    check((await withBadge.count()) === 1, 'סימון "אקורדים" בתוצאה');
    await withBadge.click();
    await page.waitForSelector('.sheet .chord:not(:empty)', { timeout: NET_TIMEOUT });
    const r = await measureAlignment(page);
    check(r.checked > 15, 'אקורדים נבדקו: ' + r.checked);
    check(r.bad.length === 0, 'יישור: ' + r.bad.join(', '));
    check(r.overlaps.length === 0, 'חפיפה: ' + r.overlaps.join(', '));
    check((await page.locator('.credit').first().innerText()).includes('נחלת הכלל'), 'מקור ורישוי מוצגים');
    const first = await page.$$eval('.chord', (els) => els.map((e) => e.textContent).filter(Boolean)[0]);
    await page.getByRole('button', { name: 'העלאת חצי טון' }).click();
    await page.getByRole('button', { name: 'העלאת חצי טון' }).click();
    const after = await page.$$eval('.chord', (els) => els.map((e) => e.textContent).filter(Boolean)[0]);
    check(first === 'G' && after === 'A', `שינוי סולם: ${first} → ${after}`);
    await page.locator('.shift-value').click();
    await page.screenshot({ path: `${SHOTS}/song-chords-phone.png` });
    // גלילה אוטומטית
    const y0 = await page.evaluate(() => scrollY);
    await page.getByRole('button', { name: 'הפעלת גלילה אוטומטית' }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'עצירת גלילה אוטומטית' }).click();
    const y1 = await page.evaluate(() => scrollY);
    await page.waitForTimeout(500);
    check(y1 > y0 && (await page.evaluate(() => scrollY)) === y1, `גלילה ועצירה ${y0}→${y1}`);
  });

  await step('7b. שיר בעברית עם אקורדים: הבה נגילה (יישור RTL, טלפון ומחשב)', async () => {
    await search(page, 'הבה נגילה', 'song');
    await page.locator('.song-item', { has: page.locator('.badge--chords') }).first().click();
    await page.waitForSelector('.sheet .chord:not(:empty)', { timeout: NET_TIMEOUT });
    for (const fi of [0, 7]) {
      await page.evaluate((v) => localStorage.setItem('fontIndex', String(v)), fi);
      await page.reload();
      await page.waitForSelector('.sheet .chord:not(:empty)', { timeout: NET_TIMEOUT });
      const r = await measureAlignment(page);
      check(r.bad.length === 0 && r.above.length === 0, `יישור עברית font#${fi}: ` + r.bad.join(', '));
    }
    await page.evaluate(() => localStorage.setItem('fontIndex', '3'));
    await page.setViewportSize(DESKTOP);
    await page.reload();
    await page.waitForSelector('.sheet .chord:not(:empty)', { timeout: NET_TIMEOUT });
    const r = await measureAlignment(page);
    check(r.bad.length === 0, 'יישור במחשב: ' + r.bad.join(', '));
    await page.screenshot({ path: `${SHOTS}/song-hebrew-desktop.png` });
    await page.setViewportSize(PHONE);
  });

  await step('7c. גיליון אישי לשיר בלי אקורדים', async () => {
    await search(page, 'hotel california');
    await page.locator('.song-item').first().click();
    await page.waitForSelector('.no-chords', { timeout: NET_TIMEOUT });
    await page.getByRole('button', { name: 'הוספת אקורדים משלי' }).click();
    await page.getByRole('button', { name: 'שמירה' }).click();
    check((await page.locator('[role=alert]').innerText()).includes('ריק'), 'אימות גיליון ריק');
    await page.fill('#sheet-text', '{בית}\n[Am]בדיקה של גיליון [E]אישי\nשורה ש[G]נייה בא[D]מצע מילה');
    check((await page.locator('.preview .chord:not(:empty)').count()) === 4, 'תצוגה מקדימה');
    await page.getByRole('button', { name: 'שמירה' }).click();
    await page.waitForSelector('.sheet-wrap .chord:not(:empty)');
    check((await page.locator('.credit').first().innerText()).includes('הגיליון האישי שלי'), 'מקור: גיליון אישי');
    const r = await measureAlignment(page);
    check(r.bad.length === 0, 'יישור גיליון אישי: ' + r.bad.join(', '));
    await page.goto(BASE + '#/');
    check((await page.locator('.idle').innerText()).includes('Hotel California'), 'גיליון אישי מופיע בדף הבית');
  });
} finally {
  await browser.close();
  server.kill();
}

console.log(`\n${passes} עברו, ${failures} נכשלו`);
process.exit(failures ? 1 : 0);
