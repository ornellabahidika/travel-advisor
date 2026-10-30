// SerpAPI client: real Google Flights and Google Hotels results.
//
// This is the top of the price ladder. Google runs the actual fare and
// rate queries; SerpAPI exposes the results as JSON. Activation requires
// SERPAPI_KEY (serpapi.com, free tier 100 searches/month). When the key
// is absent or a lookup fails, callers fall back to Travelpayouts (flights)
// and the harvest/model estimates in lib/fareModel.ts.
//
// Cost discipline: only the trip-details page uses these (two searches per
// trip view). The suggest page intentionally stays on the free distance
// model, because five destinations per search would burn the quota fast.

import { toCityCode } from "./iata";
import type { FlightOption, HotelOption } from "./types";

export function serpapiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_KEY);
}

type SerpFlightLeg = {
  airline?: string;
  duration?: number; // minutes
};

type SerpFlightItem = {
  flights?: SerpFlightLeg[];
  total_duration?: number; // minutes
  price?: number; // per person, in requested currency
  layovers?: { duration?: number }[];
};

type SerpFlightsResponse = {
  best_flights?: SerpFlightItem[];
  other_flights?: SerpFlightItem[];
  search_metadata?: { google_flights_url?: string };
  error?: string;
};

export async function searchFlightsSerp(
  originName: string,
  destName: string,
  startDate: string,
  endDate: string,
  currency: string,
  travelers: number,
  signal?: AbortSignal,
): Promise<FlightOption[]> {
  const KEY = process.env.SERPAPI_KEY;
  if (!KEY) return [];
  const originCode = toCityCode(originName);
  const destCode = toCityCode(destName);
  if (!originCode || !destCode) return [];
  const group = Math.max(1, Math.round(travelers));

  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: originCode,
    arrival_id: destCode,
    outbound_date: startDate,
    return_date: endDate,
    type: "1", // round trip
    adults: String(group),
    currency: currency.toUpperCase(),
    hl: "en",
    api_key: KEY,
  });

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SerpFlightsResponse;
    if (data.error) return [];
    const items = [...(data.best_flights ?? []), ...(data.other_flights ?? [])];
    if (items.length === 0) return [];
    return items
      .filter((f) => typeof f.price === "number" && f.price > 0)
      .slice(0, 5)
      .map((f) => {
        const airline =
          f.flights?.[0]?.airline ?? "Multiple airlines";
        const stops = Math.max(0, (f.flights?.length ?? 1) - 1);
        const durationH =
          Math.round(((f.total_duration ?? 0) / 60) * 10) / 10;
        return {
          airline,
          // Google Flights prices are the TOTAL for the passengers in the
          // query when adults=N is passed... except when it quotes per
          // person. SerpAPI passes through Google's displayed price, which
          // for multi-passenger queries is the whole-party total. Keep as
          // returned.
          approxPrice: f.price as number,
          currency: currency.toUpperCase(),
          durationHours: durationH,
          stops,
          notes:
            group > 1
              ? `Round trip, total for ${group} travelers (Google Flights)`
              : "Round trip (Google Flights)",
          // Per-flight URL: Google Flights filters by airline when the
          // carrier name is in the query, so clicking "Delta $450" lands
          // on Delta's row rather than the shared batch URL from
          // search_metadata (which was the same for every flight card
          // and often didn't surface the card the user clicked).
          bookingUrl: `https://www.google.com/travel/flights?q=${encodeURIComponent(
            `flights from ${originCode} to ${destCode} on ${airline} ${startDate} return ${endDate}`,
          )}&hl=en&curr=USD`,
          isLive: true,
        } satisfies FlightOption;
      })
      .sort((a, b) => a.approxPrice - b.approxPrice);
  } catch {
    return [];
  }
}

type SerpHotelProperty = {
  name?: string;
  link?: string;
  overall_rating?: number;
  hotel_class?: string;
  rate_per_night?: { extracted_lowest?: number; lowest?: string };
  total_rate?: { extracted_lowest?: number };
  nearby_places?: { name?: string }[];
  amenities?: string[];
};

type SerpHotelsResponse = {
  properties?: SerpHotelProperty[];
  error?: string;
};

export async function searchHotelsSerp(
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number,
  currency: string,
  signal?: AbortSignal,
): Promise<HotelOption[]> {
  const KEY = process.env.SERPAPI_KEY;
  if (!KEY) return [];
  const cityOnly = (destination.split(",")[0] ?? destination).trim();

  const params = new URLSearchParams({
    engine: "google_hotels",
    q: `${destination} hotels`,
    check_in_date: startDate,
    check_out_date: endDate,
    adults: String(Math.max(1, Math.round(travelers))),
    currency: currency.toUpperCase(),
    hl: "en",
    api_key: KEY,
  });

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SerpHotelsResponse;
    if (data.error || !data.properties) return [];
    return data.properties
      .filter(
        (p) =>
          p.name &&
          (p.rate_per_night?.extracted_lowest ?? 0) > 0,
      )
      .slice(0, 6)
      .map((p) => ({
        name: p.name as string,
        area: p.nearby_places?.[0]?.name ?? cityOnly,
        approxPricePerNight: Math.round(p.rate_per_night!.extracted_lowest!),
        currency: currency.toUpperCase(),
        ratingOutOf5: p.overall_rating ?? 4,
        highlights: (p.amenities ?? []).slice(0, 3),
        bookingUrl:
          p.link ??
          `https://www.google.com/travel/hotels/${encodeURIComponent(cityOnly)}`,
        imageUrl: null,
        isLive: true,
      } satisfies HotelOption));
  } catch {
    return [];
  }
}
