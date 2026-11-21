import { useCallback, useEffect, useState } from 'react';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* מצב גלישה פרטית וכו' – פשוט לא נשמר */
  }
}

/** state שנשמר ב-localStorage, ומסתנכרן בין לשוניות ורכיבים. */
export function usePersistent<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    setValue(read(key, fallback));
    const onChange = (e: Event) => {
      const k = e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail;
      if (k === key) setValue(read(key, fallback));
    };
    window.addEventListener('storage', onChange);
    window.addEventListener('local-pref', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('local-pref', onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        write(key, next);
        queueMicrotask(() => window.dispatchEvent(new CustomEvent('local-pref', { detail: key })));
        return next;
      });
    },
    [key],
  );

  return [value, set];
}

export interface FavoriteSong {
  id: string;
  title: string;
  artist: string;
}

export function useFavorites() {
  const [favs, setFavs] = usePersistent<FavoriteSong[]>('favorites:v2', []);
  const toggle = useCallback(
    (song: FavoriteSong) =>
      setFavs((f) =>
        f.some((x) => x.id === song.id)
          ? f.filter((x) => x.id !== song.id)
          : [{ id: song.id, title: song.title, artist: song.artist }, ...f],
      ),
    [setFavs],
  );
  return { favorites: favs, isFavorite: (id: string) => favs.some((x) => x.id === id), toggle };
}
