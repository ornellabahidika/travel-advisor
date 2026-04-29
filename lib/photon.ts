// Client wrapper for the /api/places edge-cached autocomplete endpoint.
// The actual Photon → PlaceOption formatting happens server-side in the
// edge route (app/api/places/route.ts) so responses can be cached at
// Vercel's CDN for 24h.

export type PlaceKind = "city" | "country" | "airport";

export type PlaceOption = {
  value: string;
  name: string;
  sub?: string;
  kind: PlaceKind;
};

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  limit = 10,
): Promise<PlaceOption[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `/api/places?q=${encodeURIComponent(q)}&limit=${limit}`,
      { signal },
    );
    if (!res.ok) return [];
    return (await res.json()) as PlaceOption[];
  } catch {
    return [];
  }
}
