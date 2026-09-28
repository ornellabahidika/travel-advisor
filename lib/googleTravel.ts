// Free fallback price source: Google Flights and Google Hotels server-render
// their result cards with structured aria-labels, readable from the plain
// HTML response. Verified 2026-09-27:
//   flights: "From 594 US dollars round trip total. 1 stop flight with
//             American. Leaves ... at 12:25 AM ..."
//   hotels:  "Prices starting from $96, Hotel Galeria Plaza Reforma"
//
// This sits BELOW SerpAPI and Travelpayouts in the price ladder: it costs
// nothing and needs no key, but it is a best-effort read of a page Google
// may reshape or rate-limit at any time. Every failure path returns [] so
// callers degrade to the deterministic model. Results are cached in memory
// for six hours per route to keep request volume polite.

import { toCityCode } from "./iata";
import { fromUsd } from "./fareModel";
import type { FlightOption, HotelOption } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 6 * 60 * 60 * 1000;

export function googleFallbackEnabled(): boolean {
  return process.env.GOOGLE_TRAVEL_FALLBACK !== "off";
}

async function fetchPage(url: string): Promise<string | null> {
  if (!googleFallbackEnabled()) return null;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    // A consent/captcha interstitial is much smaller than a results page.
    if (html.length < 200_000) return null;
    cache.set(url, { at: Date.now(), value: html });
    return html;
  } catch {
    return null;
  }
}

export async function searchFlightsGoogle(
  originName: string,
  destName: string,
  startDate: string,
  endDate: string,
  currency: string,
  travelers: number,
): Promise<FlightOption[]> {
  const o = toCityCode(originName);
  const d = toCityCode(destName);
  if (!o || !d) return [];
  const group = Math.max(1, Math.round(travelers));
  const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(
    `flights from ${o} to ${d} on ${startDate} return ${endDate}`,
  )}&hl=en&curr=USD`;
  const html = await fetchPage(url);
  if (!html) return [];

  const out: FlightOption[] = [];
  const re =
    /From ([\d,]+) US dollars round trip total\.?\s*(Nonstop|\d+ stops?) flight with ([^.]+)\./g;
  const seen = new Set<string>();
  for (const m of html.matchAll(re)) {
    const perPersonUsd = Number(m[1].replace(/,/g, ""));
    if (!perPersonUsd || perPersonUsd < 40 || perPersonUsd > 20000) continue;
    const stops = m[2] === "Nonstop" ? 0 : Number(m[2].match(/\d+/)?.[0] ?? 1);
    const airline = m[3].trim().replace(/ and .*$/, "").slice(0, 40);
    const key = `${airline}:${perPersonUsd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      airline,
      approxPrice: Math.round(fromUsd(perPersonUsd, currency)) * group,
      currency: currency.toUpperCase(),
      durationHours: 0,
      stops,
      notes:
        group > 1
          ? `Round trip, total for ${group} travelers (Google Flights)`
          : "Round trip (Google Flights)",
      bookingUrl: url,
      isLive: true,
    });
    if (out.length >= 5) break;
  }
  return out.sort((a, b) => a.approxPrice - b.approxPrice);
}

export async function searchHotelsGoogle(
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number,
  currency: string,
): Promise<HotelOption[]> {
  const cityOnly = (destination.split(",")[0] ?? destination).trim();
  const url = `https://www.google.com/travel/hotels/${encodeURIComponent(
    cityOnly,
  )}?q=${encodeURIComponent(`${destination} hotels`)}&checkin=${startDate}&checkout=${endDate}&hl=en&curr=USD`;
  const html = await fetchPage(url);
  if (!html) return [];

  const out: HotelOption[] = [];
  const seen = new Set<string>();
  const re = /Prices starting from \$([\d,]+), ([^"]{3,90}?)(?: DEAL [^"]*)?"/g;
  for (const m of html.matchAll(re)) {
    const usd = Number(m[1].replace(/,/g, ""));
    const name = m[2].trim();
    if (!usd || usd < 15 || usd > 5000) continue;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({
      name,
      area: cityOnly,
      approxPricePerNight: Math.round(fromUsd(usd, currency)),
      currency: currency.toUpperCase(),
      ratingOutOf5: 4,
      highlights: ["Live price via Google Hotels"],
      bookingUrl: `https://www.google.com/travel/hotels/${encodeURIComponent(cityOnly)}?q=${encodeURIComponent(name)}&checkin=${startDate}&checkout=${endDate}`,
      imageUrl: null,
      isLive: true,
    });
    if (out.length >= 6) break;
  }
  return out;
}
