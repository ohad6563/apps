import { providers } from '../content/registry';
import { PUBLIC_DOMAIN_TITLES } from '../content/publicDomain';
import { searchHref } from '../router';
import { BackIcon } from './Icons';

/** שקיפות: מאיפה מגיע כל מידע, ומה עדיין חסר. */
export function SourcesPage() {
  return (
    <main className="home prose">
      <a href="#/" className="back-link">
        <BackIcon />
        <span>חזרה לחיפוש</span>
      </a>
      <h1>מקורות המידע והאקורדים</h1>

      <h2>קטלוג השירים</h2>
      <p>
        החיפוש מחובר ל־
        <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">
          MusicBrainz
        </a>
        , מאגר מוזיקה פתוח עם מיליוני הקלטות ואמנים מכל העולם, כולל שירים בעברית. ממנו מגיעים שמות השירים,
        האמנים, השמות החלופיים, השנים, הסגנונות והכותבים. MusicBrainz לא מספק אקורדים ולא מילים.
      </p>

      <h2>מקורות אקורדים</h2>
      <ul className="provider-list">
        {providers.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong>{' '}
            <span className={'badge ' + (p.isEnabled() ? 'badge--easy' : '')}>
              {p.isEnabled() ? 'פעיל' : 'לא מחובר'}
            </span>
            <p>{p.description}</p>
            {p.id === 'public-domain' && (
              <p className="muted">
                {PUBLIC_DOMAIN_TITLES.map((t, i) => (
                  <span key={t}>
                    {i > 0 && ' · '}
                    <a href={searchHref(t, 'song')}>{t}</a>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>

      <h2>מה חסר כדי להציג אקורדים לרוב השירים</h2>
      <p>
        אין כיום API ציבורי וחוקי שמספק אקורדים ומילים לשירים מסחריים. אתרי האקורדים הגדולים לא מציעים API
        פתוח, ולכן השירון לא מעתיק מהם תוכן. כדי להגיע לכיסוי רחב צריך הסכם תוכן: רישיון ממאגר אקורדים (למשל
        באמצעות הסכם עם אתר אקורדים קיים), ורישיון להצגת מילים (באישור אקו״ם או המו״לים בישראל, או דרך ספק
        מילים מורשה בחו״ל). כשיש הסכם כזה, מחברים את השרת דרך ממשק הספקים הקיים, ואין צורך לשנות את האתר.
      </p>
      <p>עד אז אפשר להוסיף לכל שיר גיליון אישי, שנשמר רק אצלכם.</p>
    </main>
  );
}
