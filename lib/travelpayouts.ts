// Travelpayouts API client — flights via Aviasales, hotels via HotelLook.
// Both endpoints return real prices and real bookable links wrapped with
// our affiliate marker (so we earn commission on bookings).
//
// Activation: only kicks in when TRAVELPAYOUTS_TOKEN is set on the server.
// When absent, callers should fall back to LLM-generated estimates so the
// app still works in dev / test environments.

import { toCityCode } from "./iata";
import type { FlightOption, HotelOption } from "./types";

// Inverted from AIRLINE_TO_CODE in lib/iata.ts. Aviasales returns 2-letter
// IATA codes ("AF") but users want carrier names ("Air France").
const AIRLINE_CODE_TO_NAME: Record<string, string> = {
  DL: "Delta",
  AA: "American",
  UA: "United",
  AS: "Alaska",
  B6: "JetBlue",
  WN: "Southwest",
  NK: "Spirit",
  F9: "Frontier",
  HA: "Hawaiian",
  AC: "Air Canada",
  WS: "WestJet",
  AM: "Aeromexico",
  CM: "Copa",
  LA: "LATAM",
  AV: "Avianca",
  AD: "Azul",
  G3: "Gol",
  BA: "British Airways",
  VS: "Virgin Atlantic",
  U2: "EasyJet",
  FR: "Ryanair",
  W6: "Wizz Air",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  LX: "Swiss",
  OS: "Austrian",
  SN: "Brussels Airlines",
  IB: "Iberia",
  VY: "Vueling",
  TP: "TAP Portugal",
  AZ: "ITA Airways",
  A3: "Aegean",
  TK: "Turkish Airlines",
  SK: "SAS",
  AY: "Finnair",
  DY: "Norwegian",
  FI: "Icelandair",
  LO: "LOT Polish",
  EI: "Aer Lingus",
  EK: "Emirates",
  EY: "Etihad",
  QR: "Qatar Airways",
  SV: "Saudia",
  LY: "El Al",
  ET: "Ethiopian",
  MS: "EgyptAir",
  KQ: "Kenya Airways",
  WB: "RwandAir",
  SA: "South African",
  AT: "Royal Air Maroc",
  JL: "Japan Airlines",
  NH: "ANA",
  KE: "Korean Air",
  OZ: "Asiana",
  CZ: "China Southern",
  MU: "China Eastern",
  CA: "Air China",
  CX: "Cathay Pacific",
  BR: "EVA Air",
  CI: "China Airlines",
  SQ: "Singapore Airlines",
  TG: "Thai Airways",
  VN: "Vietnam Airlines",
  PR: "Philippine Airlines",
  MH: "Malaysia Airlines",
  GA: "Garuda Indonesia",
  AI: "Air India",
  "6E": "IndiGo",
  UK: "Vistara",
  QF: "Qantas",
  VA: "Virgin Australia",
  NZ: "Air New Zealand",
  FJ: "Fiji Airways",
  U6: "Ural Airlines",
  S7: "S7 Airlines",
};

function airlineNameFromCode(code: string): string {
  return AIRLINE_CODE_TO_NAME[code] ?? code;
}

export function travelpayoutsConfigured(): boolean {
  return Boolean(process.env.TRAVELPAYOUTS_TOKEN);
}

type AviasalesOffer = {
  airline: string;
  price: number;
  duration: number; // minutes
  transfers: number;
  link: string;
};

type AviasalesResponse = {
  success: boolean;
  data?: AviasalesOffer[];
  currency?: string;
};

export async function searchFlights(
  originName: string,
  destName: string,
  startDate: string,
  endDate: string,
  currency: string,
  signal?: AbortSignal,
): Promise<FlightOption[]> {
  const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
  const MARKER = process.env.TRAVELPAYOUTS_MARKER;
  if (!TOKEN) return [];

  const originCode = toCityCode(originName);
  const destCode = toCityCode(destName);
  if (!originCode || !destCode) return [];

  const params = new URLSearchParams({
    origin: originCode,
    destination: destCode,
    departure_at: startDate,
    return_at: endDate,
    currency: currency.toLowerCase(),
    sorting: "price",
    limit: "5",
    direct: "false",
    token: TOKEN,
  });

  try {
    const res = await fetch(
      `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params.toString()}`,
      { signal, headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as AviasalesResponse;
    if (!data.success || !data.data || data.data.length === 0) return [];
    return data.data.slice(0, 5).map((f) => {
      let url = `https://www.aviasales.com${f.link}`;
      if (MARKER) {
        url += url.includes("?") ? `&marker=${MARKER}` : `?marker=${MARKER}`;
      }
      const hours = Math.round((f.duration / 60) * 10) / 10;
      return {
        airline: airlineNameFromCode(f.airline),
        approxPrice: f.price,
        currency: currency.toUpperCase(),
        durationHours: hours,
        stops: f.transfers ?? 0,
        notes: "",
        bookingUrl: url,
        isLive: true,
      } satisfies FlightOption;
    });
  } catch {
    return [];
  }
}

type HotelLookHotel = {
  hotelId: number;
  hotelName: string;
  stars?: number;
  priceFrom?: number;
  priceAvg?: number;
  location?: { name?: string; country?: string };
};

export async function searchHotels(
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number,
  currency: string,
  signal?: AbortSignal,
): Promise<HotelOption[]> {
  const MARKER = process.env.TRAVELPAYOUTS_MARKER;
  if (!process.env.TRAVELPAYOUTS_TOKEN) return [];

  // HotelLook expects a city name. "Paris, Île-de-France, France" → "Paris".
  const cityOnly = (destination.split(",")[0] ?? destination).trim();

  const params = new URLSearchParams({
    location: cityOnly,
    checkIn: startDate,
    checkOut: endDate,
    currency: currency.toLowerCase(),
    adults: String(Math.max(1, travelers)),
    limit: "10",
  });

  try {
    const res = await fetch(
      `https://engine.hotellook.com/api/v2/cache.json?${params.toString()}`,
      { signal, headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as HotelLookHotel[];
    if (!Array.isArray(data) || data.length === 0) return [];

    const nights = Math.max(
      1,
      Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    return data
      .filter((h) => h.priceFrom && h.priceFrom > 0 && h.hotelName)
      .slice(0, 8)
      .map((h) => {
        const totalPrice = h.priceFrom ?? 0;
        const pricePerNight = Math.round(totalPrice / nights);
        const linkParams = new URLSearchParams({
          destination: cityOnly,
          checkIn: startDate,
          checkOut: endDate,
          adults: String(Math.max(1, travelers)),
          hotelId: String(h.hotelId),
        });
        if (MARKER) linkParams.set("marker", MARKER);
        const url = `https://search.hotellook.com/hotels?${linkParams.toString()}`;
        return {
          name: h.hotelName,
          area: h.location?.name ?? cityOnly,
          approxPricePerNight: pricePerNight,
          currency: currency.toUpperCase(),
          ratingOutOf5: h.stars ?? 3,
          highlights: [],
          bookingUrl: url,
          imageUrl: null,
          isLive: true,
        } satisfies HotelOption;
      });
  } catch {
    return [];
  }
}
