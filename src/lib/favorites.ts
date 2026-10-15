"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "favorite-exercises";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Favourite exercises (a per-device convenience, kept in localStorage). */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    setFavorites(read());
    const onStorage = (e: StorageEvent) => e.key === KEY && setFavorites(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const toggle = useCallback((id: string) => {
    setFavorites((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable – keep in memory */
      }
      return next;
    });
  }, []);
  return { favorites, toggle };
}
