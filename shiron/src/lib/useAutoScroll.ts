import { useCallback, useEffect, useRef, useState } from 'react';

export const MIN_SPEED = 1;
export const MAX_SPEED = 10;

/** פיקסלים לשנייה עבור כל רמת מהירות. */
export function pxPerSecond(level: number): number {
  return 6 + level * 7;
}

/**
 * גלילה אוטומטית חלקה של החלון.
 * גלילה ידנית של המשתמש בזמן הפעולה נשמרת (לא "קופצים" חזרה),
 * והגלילה נעצרת מעצמה בסוף העמוד.
 */
export function useAutoScroll(initialSpeed = 3) {
  const [active, setActive] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let stuckFrames = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += pxPerSecond(speedRef.current) * dt;
      const whole = Math.floor(acc);
      if (whole >= 1) {
        acc -= whole;
        const before = window.scrollY;
        window.scrollBy(0, whole);
        const atBottom =
          Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1;
        stuckFrames = window.scrollY === before ? stuckFrames + 1 : 0;
        if (atBottom || stuckFrames > 3) {
          setActive(false);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const toggle = useCallback(() => setActive((a) => !a), []);
  const stop = useCallback(() => setActive(false), []);
  const faster = useCallback(() => setSpeed((s) => Math.min(MAX_SPEED, s + 1)), []);
  const slower = useCallback(() => setSpeed((s) => Math.max(MIN_SPEED, s - 1)), []);

  return {
    active,
    toggle,
    stop,
    speed,
    faster,
    slower,
    setSpeed,
  };
}

/** שומר על המסך דולק בזמן שהשיר פתוח (אם הדפדפן תומך). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = await (navigator as any).wakeLock.request('screen');
        if (cancelled) s.release();
        else sentinel = s;
      } catch {
        /* לא נורא – אין תמיכה או אין הרשאה */
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
