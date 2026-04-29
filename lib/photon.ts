// Free OpenStreetMap-backed geocoding (no API key, no signup).
// Docs: https://photon.komoot.io
//
// We return structured options (name + sub-line + kind) so the UI can
// render momondo-style two-line rows with type icons.

export type PlaceKind = "city" | "country" | "airport";

export type PlaceOption = {
  value: string; // canonical string stored on the form
  name: string; // bold primary line
  sub?: string; // muted secondary line
  kind: PlaceKind;
};

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

function joinNonEmpty(parts: (string | null | undefined)[], sep = ", "): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

function formatFeature(f: PhotonFeature): PlaceOption | null {
  const p = f.properties;
  const name = p.name?.trim();
  if (!name) return null;
  const country = p.country?.trim();
  const state = p.state?.trim();
  const city = p.city?.trim();

  if (p.osm_value === "aerodrome" || p.osm_value === "airport") {
    const where = city ?? state ?? country;
    const isAirportNamed = /airport/i.test(name);
    const display = isAirportNamed ? name : `${name} Airport`;
    const sub = joinNonEmpty([
      where && where !== name ? where : null,
      country && country !== where ? country : null,
    ]);
    const value = joinNonEmpty([display, where && where !== name ? where : null, country]);
    return { value, name: display, sub: sub || undefined, kind: "airport" };
  }

  if (p.osm_value === "country") {
    return { value: name, name, sub: "Country", kind: "country" };
  }

  if (
    SETTLEMENT_VALUES.has(p.osm_value ?? "") ||
    p.osm_value === "administrative" ||
    (p.osm_key === "place" && (p.type === "city" || p.type === "district"))
  ) {
    const sub = joinNonEmpty([
      state && state !== name ? state : null,
      country && country !== name ? country : null,
    ]);
    const value = joinNonEmpty([
      name,
      state && state !== name ? state : null,
      country && country !== name ? country : null,
    ]);
    return { value, name, sub: sub || undefined, kind: "city" };
  }

  return null;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  limit = 10,
): Promise<PlaceOption[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit * 2}&lang=en`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    if (!data.features) return [];
    const results: PlaceOption[] = [];
    const seen = new Set<string>();
    for (const f of data.features) {
      const opt = formatFeature(f);
      if (opt && !seen.has(opt.value)) {
        seen.add(opt.value);
        results.push(opt);
      }
    }
    // Sort: countries first (when query matches a country), then cities, then airports.
    // Momondo surfaces the most "general" choice (the country/city) first, airports below.
    const order: Record<PlaceKind, number> = { country: 0, city: 1, airport: 2 };
    results.sort((a, b) => order[a.kind] - order[b.kind]);
    return results.slice(0, limit);
  } catch {
    return [];
  }
}
