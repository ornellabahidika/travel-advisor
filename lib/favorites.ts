"use client";

import { useEffect, useState } from "react";
import type { Destination } from "./types";

const STORAGE_KEY = "tripfinder-favorites-v1";
const CHANGE_EVENT = "tripfinder:favorites-changed";

export type FavoriteItem = {
  id: string;
  destination: Destination;
  tripHref: string;
  savedAt: number;
};

function favoriteId(d: Destination): string {
  return `${d.name}__${d.country}`.toLowerCase().replace(/\s+/g, "-");
}

function read(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: FavoriteItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useFavorites() {
  const [items, setItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    setItems(read());
    const onChange = () => setItems(read());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const isFavorite = (d: Destination) =>
    items.some((i) => i.id === favoriteId(d));

  const toggleFavorite = (d: Destination, tripHref: string) => {
    const id = favoriteId(d);
    const current = read();
    const exists = current.some((i) => i.id === id);
    if (exists) {
      write(current.filter((i) => i.id !== id));
    } else {
      write([
        ...current,
        { id, destination: d, tripHref, savedAt: Date.now() },
      ]);
    }
  };

  const removeFavorite = (id: string) => {
    write(read().filter((i) => i.id !== id));
  };

  return { items, count: items.length, isFavorite, toggleFavorite, removeFavorite };
}
