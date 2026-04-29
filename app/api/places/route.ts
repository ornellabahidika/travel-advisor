// Edge-cached location autocomplete proxy.
//
// Photon is free + no API key, but its single endpoint sits in Europe
// (~700ms TTFB from elsewhere). We proxy through a Vercel Edge function
// and cache each query at Vercel's CDN for 24h (with 7-day SWR), so
// repeat searches across all users return in <50ms from the nearest POP.

export const runtime = "edge";

type PhotonFeature = {
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
};

type PlaceKind = "city" | "country" | "airport";
type PlaceOption = { value: string; name: string; sub?: string; kind: PlaceKind };

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

const HOT_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";
const COLD_CACHE = "public, s-maxage=60";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));

  if (q.length < 2) {
    return Response.json([], { headers: { "cache-control": HOT_CACHE } });
  }

  const upstream = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit * 2}&lang=en`;
  let data: { features?: PhotonFeature[] };
  try {
    const res = await fetch(upstream, {
      // Hint the runtime fetch cache as a belt-and-braces alongside CDN cache.
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return Response.json([], { headers: { "cache-control": COLD_CACHE } });
    }
    data = (await res.json()) as { features?: PhotonFeature[] };
  } catch {
    return Response.json([], { headers: { "cache-control": COLD_CACHE } });
  }

  const results: PlaceOption[] = [];
  const seen = new Set<string>();
  for (const f of data.features ?? []) {
    const opt = formatFeature(f);
    if (opt && !seen.has(opt.value)) {
      seen.add(opt.value);
      results.push(opt);
    }
  }
  const order: Record<PlaceKind, number> = { country: 0, city: 1, airport: 2 };
  results.sort((a, b) => order[a.kind] - order[b.kind]);

  return Response.json(results.slice(0, limit), { headers: { "cache-control": HOT_CACHE } });
}
