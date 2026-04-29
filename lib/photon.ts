// Free OpenStreetMap-backed geocoding (no API key, no signup).
// Docs: https://photon.komoot.io
//
// Photon returns mixed POI types. We filter to settlements (city/town/
// village) and airports (osm_value=aerodrome) — what travelers actually
// pick as origins or destinations.

type PhotonFeature = {
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
};

const SETTLEMENT_VALUES = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "hamlet",
]);

function formatFeature(f: PhotonFeature): string | null {
  const p = f.properties;
  const name = p.name?.trim();
  if (!name) return null;
  const country = p.country?.trim();

  if (p.osm_value === "aerodrome" || p.osm_value === "airport") {
    const where = p.city ?? p.state ?? country;
    return `${name} Airport${where ? ` (${where})` : ""}${country ? ` · ${country}` : ""}`;
  }
  if (SETTLEMENT_VALUES.has(p.osm_value ?? "")) {
    const region = p.state && p.state !== name ? `, ${p.state}` : "";
    return `${name}${region}${country ? `, ${country}` : ""}`;
  }
  return null;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  limit = 10,
): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    if (!data.features) return [];
    const results: string[] = [];
    const seen = new Set<string>();
    for (const f of data.features) {
      const formatted = formatFeature(f);
      if (formatted && !seen.has(formatted)) {
        seen.add(formatted);
        results.push(formatted);
      }
    }
    return results.slice(0, limit);
  } catch {
    return [];
  }
}
