"use client";

import { useEffect, useState } from "react";

export type RecentTrip = {
  id: string;
  name: string;
  country: string;
  origin: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  travelers: number;
  interests: string;
  constraints: string;
  vibe: string;
  timestamp: number;
};

const STORAGE_KEY = "tripfinder-recents-v1";
const CHANGE_EVENT = "tripfinder:recents-changed";
const MAX_RECENTS = 8;
const GUEST = "guest";

type Store = Record<string, RecentTrip[]>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function currentUserId(): string {
  if (typeof window === "undefined") return GUEST;
  try {
    const raw = window.localStorage.getItem("tripfinder-auth-v1");
    if (!raw) return GUEST;
    const u = JSON.parse(raw);
    return u?.id ?? GUEST;
  } catch {
    return GUEST;
  }
}

function makeId(name: string, country: string, origin: string, start: string): string {
  return `${name}__${country}__${origin}__${start}`
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function recordRecentTrip(input: Omit<RecentTrip, "id" | "timestamp">) {
  if (typeof window === "undefined") return;
  const id = makeId(input.name, input.country, input.origin, input.startDate);
  const userId = currentUserId();
  const store = read();
  const list = store[userId] ?? [];
  // Dedup + bump to top
  const filtered = list.filter((i) => i.id !== id);
  const updated: RecentTrip[] = [
    { ...input, id, timestamp: Date.now() },
    ...filtered,
  ].slice(0, MAX_RECENTS);
  store[userId] = updated;
  write(store);
}

export function removeRecentTrip(id: string) {
  const userId = currentUserId();
  const store = read();
  store[userId] = (store[userId] ?? []).filter((i) => i.id !== id);
  write(store);
}

export function mergeGuestInto(userId: string) {
  const store = read();
  const guest = store[GUEST] ?? [];
  if (guest.length === 0) return;
  const existing = store[userId] ?? [];
  const merged: RecentTrip[] = [...existing];
  for (const g of guest) {
    if (!merged.some((m) => m.id === g.id)) merged.push(g);
  }
  merged.sort((a, b) => b.timestamp - a.timestamp);
  store[userId] = merged.slice(0, MAX_RECENTS);
  delete store[GUEST];
  write(store);
}

export function useRecents() {
  const [items, setItems] = useState<RecentTrip[]>([]);

  useEffect(() => {
    const refresh = () => {
      const userId = currentUserId();
      setItems(read()[userId] ?? []);
    };
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("tripfinder:auth-changed", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tripfinder:auth-changed", refresh);
    };
  }, []);

  return { items, count: items.length };
}

export function tripUrlFromRecent(item: RecentTrip): string {
  const params = new URLSearchParams({
    name: item.name,
    country: item.country,
    origin: item.origin,
    start: item.startDate,
    end: item.endDate,
    budget: String(item.budget),
    currency: item.currency,
    interests: item.interests,
    constraints: item.constraints,
    vibe: item.vibe,
    travelers: String(item.travelers),
  });
  return `/trip?${params.toString()}`;
}
