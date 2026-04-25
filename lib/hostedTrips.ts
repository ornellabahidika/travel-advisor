"use client";

import { useEffect, useState } from "react";
import type { GroupTrip } from "./types";

export type HostedTrip = GroupTrip & {
  destinationKey: string;
  hostedByMe: true;
};

const STORAGE_KEY = "tripfinder-hosted-trips-v1";
const CHANGE_EVENT = "tripfinder:hosted-trips-changed";

function read(): HostedTrip[] {
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

function write(items: HostedTrip[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function destinationKey(name: string, country: string): string {
  return `${name}__${country}`.toLowerCase().replace(/\s+/g, "-");
}

export function useHostedTrips(destKey: string) {
  const [items, setItems] = useState<HostedTrip[]>([]);

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

  const filtered = items.filter((i) => i.destinationKey === destKey);

  const addHosted = (trip: Omit<GroupTrip, "id">) => {
    const newTrip: HostedTrip = {
      ...trip,
      id: `host-${Date.now()}`,
      destinationKey: destKey,
      hostedByMe: true,
    };
    write([...read(), newTrip]);
  };

  const removeHosted = (id: string) => {
    write(read().filter((i) => i.id !== id));
  };

  return { hosted: filtered, addHosted, removeHosted };
}
