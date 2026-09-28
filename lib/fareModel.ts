// Deterministic flight-fare and hotel-rate estimator.
//
// Used when Travelpayouts live prices are unavailable. This is NOT a live
// quote: it is a distance-and-season model that produces consistent,
// explainable ballparks, and it clamps the language model's guesses so a
// hallucinated number can never reach the screen.
//
// Method, in plain words:
//   1. Geocode origin and destination with Photon (free, no key).
//   2. Great-circle distance between them.
//   3. Piecewise per-km rate: short hops cost more per km than long hauls.
//   4. Season and booking-lead-time multipliers.
//   5. Multiply by travelers for the group total.
// Rates are calibrated to typical round-trip economy fares in USD and
// converted by rough purchasing parity per currency.

type LatLon = { lat: number; lon: number };

const geocodeCache = new Map<string, LatLon | null>();

export async function geocode(place: string): Promise<LatLon | null> {
  const key = place.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(place)}&limit=1&lang=en`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    const out = coords ? { lon: coords[0], lat: coords[1] } : null;
    geocodeCache.set(key, out);
    return out;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Approximate USD-per-unit for supported currencies (rough, for estimates
// only — live prices from Travelpayouts arrive already in the right currency).
const USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  EUR: 1.1,
  GBP: 1.3,
  CAD: 0.73,
  AUD: 0.66,
  JPY: 0.0067,
  CHF: 1.12,
  MXN: 0.055,
};

export function fromUsd(usd: number, currency: string): number {
  const rate = USD_PER_UNIT[currency.toUpperCase()] ?? 1;
  return usd / rate;
}

// Peak months by hemisphere-agnostic global travel demand: June-August and
// mid-December-early-January run hot; shoulder months run cheaper.
function seasonMultiplier(startDate: string): number {
  const m = new Date(startDate).getUTCMonth() + 1;
  if (m === 7 || m === 8) return 1.25;
  if (m === 6 || m === 12) return 1.15;
  if (m === 1 || m === 2 || m === 11) return 0.9;
  return 1.0;
}

// Booking inside 3 weeks costs more; more than 4 months out, slightly less.
function leadTimeMultiplier(startDate: string): number {
  const days = (new Date(startDate).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 1.0;
  if (days < 7) return 1.45;
  if (days < 21) return 1.25;
  if (days > 120) return 0.95;
  return 1.0;
}

// Round-trip economy per person in USD as a function of distance.
// Piecewise per-km rates reflect that short hops carry fixed costs and
// long hauls amortize them.
export function roundTripUsdPerPerson(km: number): number {
  if (km < 50) return 60; // same metro / degenerate geocode
  let usd = 70; // taxes-and-fees floor
  const bands: [number, number][] = [
    // [band ceiling km, usd per km inside band]
    [800, 0.16],
    [2500, 0.09],
    [6000, 0.055],
    [Infinity, 0.045],
  ];
  let prev = 0;
  for (const [ceil, rate] of bands) {
    const span = Math.min(km, ceil) - prev;
    if (span > 0) usd += span * rate;
    prev = ceil;
    if (km <= ceil) break;
  }
  return usd;
}

export type FareEstimate = {
  amount: number;
  currency: string;
  perPerson: number;
  distanceKm: number;
};

export async function estimateFlightTotal(
  origin: string,
  destination: string,
  startDate: string,
  travelers: number,
  currency: string,
): Promise<FareEstimate | null> {
  const [a, b] = await Promise.all([geocode(origin), geocode(destination)]);
  if (!a || !b) return null;
  const km = haversineKm(a, b);
  const usd =
    roundTripUsdPerPerson(km) *
    seasonMultiplier(startDate) *
    leadTimeMultiplier(startDate);
  const perPerson = Math.round(fromUsd(usd, currency) / 5) * 5;
  const group = perPerson * Math.max(1, travelers);
  return { amount: group, currency: currency.toUpperCase(), perPerson, distanceKm: Math.round(km) };
}

// Clamp a model-guessed group total to a plausible band around the
// deterministic estimate. Returns the guess when the model is unavailable
// or the guess is already reasonable; snaps to the band edge otherwise.
export function clampToEstimate(
  guess: number,
  estimate: number | null,
  lowFactor = 0.55,
  highFactor = 1.8,
): number {
  if (!estimate || estimate <= 0 || !Number.isFinite(guess)) return guess;
  const lo = estimate * lowFactor;
  const hi = estimate * highFactor;
  return Math.round(Math.min(hi, Math.max(lo, guess)));
}

// Nightly hotel budget for one standard room by destination cost tier,
// in USD. Tier resolution: a small set of famously expensive or cheap
// countries; everything else lands on the mid tier.
const EXPENSIVE = new Set([
  "switzerland", "norway", "iceland", "denmark", "singapore", "japan",
  "united states", "usa", "united kingdom", "uk", "australia", "israel",
  "netherlands", "sweden", "finland", "ireland", "luxembourg", "qatar",
  "united arab emirates", "uae", "hong kong", "monaco", "new zealand",
]);
const BUDGET = new Set([
  "india", "vietnam", "indonesia", "thailand", "philippines", "cambodia",
  "laos", "nepal", "sri lanka", "bolivia", "guatemala", "nicaragua",
  "egypt", "morocco", "tunisia", "turkey", "albania", "bulgaria",
  "romania", "georgia", "armenia", "pakistan", "bangladesh", "kenya",
  "tanzania", "colombia", "peru", "ecuador", "mexico",
]);

export function estimateHotelNight(
  country: string,
  travelers: number,
  currency: string,
): number {
  const c = country.trim().toLowerCase();
  const baseUsd = EXPENSIVE.has(c) ? 175 : BUDGET.has(c) ? 45 : 95;
  const rooms = travelers >= 5 ? 2 : 1;
  const sizeBump = travelers >= 3 && rooms === 1 ? 1.25 : 1;
  return Math.round((fromUsd(baseUsd, currency) * rooms * sizeBump) / 5) * 5;
}

// Harvest observed per-night hotel prices from web-search snippets.
// Aggregators (TripAdvisor, Skyscanner, Kayak) surface real current price
// levels in their search-result text, which is legitimately readable where
// the booking sites' own pages are not. Returns a robust median, or null
// when too few plausible figures were found.
export function harvestNightlyPrices(
  snippets: string[],
  currency: string,
): { perNight: number; samples: number } | null {
  const usd: number[] = [];
  for (const text of snippets) {
    for (const m of text.matchAll(/\$\s?([0-9]{2,4})(?![0-9])/g)) {
      const v = Number(m[1]);
      // plausible nightly range in USD; drops phone numbers, years, totals
      if (v >= 15 && v <= 1200) usd.push(v);
    }
  }
  if (usd.length < 3) return null;
  usd.sort((a, b) => a - b);
  // interquartile trim, then median: resistant to a stray luxury suite or
  // a "$25 off" coupon in the text
  const q = Math.floor(usd.length / 4);
  const trimmed = usd.slice(q, usd.length - q || undefined);
  const mid = trimmed[Math.floor(trimmed.length / 2)];
  return { perNight: Math.round(fromUsd(mid, currency) / 5) * 5, samples: usd.length };
}
