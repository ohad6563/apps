import { HeartIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon } from './Icons';
import { MAX_SPEED, MIN_SPEED } from '../lib/useAutoScroll';

interface Props {
  shift: number;
  onTranspose: (delta: number) => void;
  onResetTranspose: () => void;
  canSmaller: boolean;
  canBigger: boolean;
  onFont: (delta: number) => void;
  scrolling: boolean;
  speed: number;
  onToggleScroll: () => void;
  onSpeed: (delta: number) => void;
  favorite: boolean;
  onToggleFavorite: () => void;
}

const fmtShift = (n: number) => (n === 0 ? '0' : n > 0 ? `+${n}` : `−${-n}`);

/** סרגל כלים מינימלי: סולם · גודל טקסט · גלילה · מועדפים. */
export function Toolbar(p: Props) {
  return (
    <nav className="toolbar" aria-label="כלי נגינה">
      {p.scrolling && (
        <div className="speed-pill" role="group" aria-label="מהירות גלילה">
          <button
            className="icon-btn sm"
            onClick={() => p.onSpeed(-1)}
            disabled={p.speed <= MIN_SPEED}
            aria-label="האטת הגלילה"
          >
            <MinusIcon />
          </button>
          <span className="speed-value" aria-live="polite">
            מהירות {p.speed}
          </span>
          <button
            className="icon-btn sm"
            onClick={() => p.onSpeed(1)}
            disabled={p.speed >= MAX_SPEED}
            aria-label="האצת הגלילה"
          >
            <PlusIcon />
          </button>
        </div>
      )}
      <div className="toolbar-tools">
        <div className="tool" role="group" aria-label="שינוי סולם">
          <div className="tool-row">
            <button className="icon-btn" onClick={() => p.onTranspose(-1)} aria-label="הורדת חצי טון">
              <MinusIcon />
            </button>
            <button
              className={'shift-value' + (p.shift !== 0 ? ' changed' : '')}
              onClick={p.onResetTranspose}
              disabled={p.shift === 0}
              aria-label={p.shift === 0 ? 'סולם מקורי' : `הועבר ${fmtShift(p.shift)} חצאי טונים, לחצו לאיפוס`}
              title={p.shift === 0 ? 'סולם מקורי' : 'חזרה לסולם המקורי'}
              dir="ltr"
            >
              {fmtShift(p.shift)}
            </button>
            <button className="icon-btn" onClick={() => p.onTranspose(1)} aria-label="העלאת חצי טון">
              <PlusIcon />
            </button>
          </div>
          <span className="tool-caption">סולם</span>
        </div>

        <div className="tool" role="group" aria-label="גודל טקסט">
          <div className="tool-row">
            <button
              className="icon-btn text-btn"
              onClick={() => p.onFont(-1)}
              disabled={!p.canSmaller}
              aria-label="הקטנת הטקסט"
            >
              <span className="a-small">א</span>
            </button>
            <button
              className="icon-btn text-btn"
              onClick={() => p.onFont(1)}
              disabled={!p.canBigger}
              aria-label="הגדלת הטקסט"
            >
              <span className="a-big">א</span>
            </button>
          </div>
          <span className="tool-caption">טקסט</span>
        </div>

        <div className="tool">
          <div className="tool-row">
            <button
              className={'icon-btn play-btn' + (p.scrolling ? ' on' : '')}
              onClick={p.onToggleScroll}
              aria-pressed={p.scrolling}
              aria-label={p.scrolling ? 'עצירת גלילה אוטומטית' : 'הפעלת גלילה אוטומטית'}
            >
              {p.scrolling ? <PauseIcon /> : <PlayIcon />}
            </button>
          </div>
          <span className="tool-caption">גלילה</span>
        </div>

        <div className="tool">
          <div className="tool-row">
            <button
              className={'icon-btn fav-btn' + (p.favorite ? ' on' : '')}
              onClick={p.onToggleFavorite}
              aria-pressed={p.favorite}
              aria-label={p.favorite ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}
            >
              <HeartIcon filled={p.favorite} />
            </button>
          </div>
          <span className="tool-caption">{p.favorite ? 'נשמר' : 'שמירה'}</span>
        </div>
      </div>
    </nav>
  );
}
