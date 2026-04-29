// Free OpenStreetMap-backed geocoding (no API key, no signup).
// Docs: https://photon.komoot.io
//
// Photon returns mixed POI types. We accept countries, settlements
// (city/town/village/...), administrative areas (states/regions/cities
// returned as boundaries), and airports — what travelers actually pick
// as origins or destinations. We force lang=en so "Congo" returns
// "Democratic Republic of the Congo" instead of the native French name.

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
  "suburb",
  "neighbourhood",
]);

function formatFeature(f: PhotonFeature): string | null {
  const p = f.properties;
  const name = p.name?.trim();
  if (!name) return null;
  const country = p.country?.trim();

  // Airports
  if (p.osm_value === "aerodrome" || p.osm_value === "airport") {
    const where = p.city ?? p.state ?? country;
    const isAirportNamed = /airport/i.test(name);
    const label = isAirportNamed ? name : `${name} Airport`;
    return `${label}${where && where !== name ? ` (${where})` : ""}${country ? ` · ${country}` : ""}`;
  }

  // Countries
  if (p.osm_value === "country") {
    return name;
  }

  // Settlements + administrative areas (states, regions, cities returned as boundaries)
  if (
    SETTLEMENT_VALUES.has(p.osm_value ?? "") ||
    p.osm_value === "administrative" ||
    (p.osm_key === "place" && (p.type === "city" || p.type === "district"))
  ) {
    const region = p.state && p.state !== name ? `, ${p.state}` : "";
    const countryPart = country && country !== name ? `, ${country}` : "";
    return `${name}${region}${countryPart}`;
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
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit * 2}&lang=en`;
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
