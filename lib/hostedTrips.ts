"use client";

import { useEffect, useState } from "react";
import type { GroupTrip, JoinRequest } from "./types";

export type HostedTrip = GroupTrip & {
  destinationKey: string;
  hostedByMe: true;
  requests: JoinRequest[];
};

const FAKE_REQUESTERS: Omit<JoinRequest, "id" | "status">[] = [
  {
    requesterName: "Alex M.",
    requesterOrigin: "Berlin",
    message: "Hey! Love hiking and good food. Pace sounds perfect for me — would love to join.",
    daysAgo: 2,
  },
  {
    requesterName: "Sofia P.",
    requesterOrigin: "Madrid",
    message: "Solo female traveler, mid-30s, easy-going. I do mornings for exploring, afternoons for cafés. Sound like a fit?",
    daysAgo: 1,
  },
  {
    requesterName: "Tom & Lisa",
    requesterOrigin: "Toronto",
    message: "First time in this region. We'd love to share an Airbnb to keep costs down. Happy to plan or just follow along.",
    daysAgo: 3,
  },
  {
    requesterName: "Yuki H.",
    requesterOrigin: "Tokyo",
    message: "Photographer based in Tokyo. Up early most days. Looking for a relaxed group I can break off from when I want to shoot.",
    daysAgo: 0,
  },
];

function seedRequests(seed: string): JoinRequest[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const count = (h % 3) + 1; // 1-3 requests
  return FAKE_REQUESTERS.slice(0, count).map((r, i) => ({
    ...r,
    id: `req-${seed}-${i}`,
    status: "pending" as const,
  }));
}

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
    const id = `host-${Date.now()}`;
    const newTrip: HostedTrip = {
      ...trip,
      id,
      destinationKey: destKey,
      hostedByMe: true,
      requests: seedRequests(id),
    };
    write([...read(), newTrip]);
  };

  const removeHosted = (id: string) => {
    write(read().filter((i) => i.id !== id));
  };

  const updateRequest = (
    tripId: string,
    requestId: string,
    nextStatus: "accepted" | "denied",
  ) => {
    const all = read();
    const next = all.map((t) => {
      if (t.id !== tripId) return t;
      const updatedRequests = t.requests.map((r) =>
        r.id === requestId ? { ...r, status: nextStatus } : r,
      );
      const wasPending = t.requests.find(
        (r) => r.id === requestId && r.status === "pending",
      );
      const travelersCount =
        nextStatus === "accepted" && wasPending
          ? Math.min(t.capacity, t.travelersCount + 1)
          : t.travelersCount;
      return { ...t, requests: updatedRequests, travelersCount };
    });
    write(next);
  };

  return { hosted: filtered, addHosted, removeHosted, updateRequest };
}
