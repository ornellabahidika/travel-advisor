import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { tavily } from "@tavily/core";
import { z } from "zod";
import {
  isMockMode,
  mockBudgetBreakdown,
  mockDelay,
  mockEvents,
  mockGroupTrips,
  mockRestaurants,
  mockReviews,
  mockThingsToDo,
  mockTransportation,
  mockTripDetails,
} from "@/lib/mocks";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import {
  TripDetailsInputSchema,
  type FlightOption,
  type HotelOption,
  type TripDetails,
  type TripDetailsResponse,
} from "@/lib/types";
import { toAirlineCode, toCityCode } from "@/lib/iata";
import { clampToEstimate, estimateFlightTotal, estimateHotelNight, harvestNightlyPrices } from "@/lib/fareModel";
import { searchFlightsSerp, searchHotelsSerp, serpapiConfigured } from "@/lib/serpapi";
import { searchFlightsGoogle, searchHotelsGoogle } from "@/lib/googleTravel";

export const maxDuration = 60;
export const runtime = "nodejs";

const LOGISTICS_PROMPT = `You are a senior travel planner. Given user constraints and live web data, produce ONLY the requested logistics sections (flight options and/or hotel options, as listed in the schema).

Rules:
- Use the Tavily sources (categories "flights", "hotels") as ground truth for prices, airline names, hotel names, neighborhoods. Estimate conservatively when exact prices are missing.
- Flights: prices are GROUP TOTAL for the stated number of travelers (per-person x travelers). Sort cheapest first. For each, set sourceIndex to the index of the Tavily "flights" source that best matches (for the "Book" link). Null if no good match.
- Hotels: CRITICAL, only suggest hotels that REALLY EXIST and are very likely to be listed on Booking.com. Prefer well-known international chains (Marriott, Hilton, Hyatt, Accor/Sofitel/Mercure/Novotel/Ibis, IHG/Holiday Inn/Crowne Plaza, Kempinski, Radisson, Four Seasons, Mandarin Oriental) or famously-listed independents named in the Tavily "hotels" sources. NEVER invent plausible-sounding boutique names. If unsure a property exists, prefer a chain. Must fit within roughly (budget - flights) / nights per night for the group. 1-2 travelers: one standard room. 3-4: one larger room, family room, or two standard. 5+: two rooms or apartment rental. Mention occupancy in highlights where relevant. For each, set sourceIndex to the best Tavily "hotels" source. imageIndex = index in the images array that visually represents the hotel, or null.
- Respect the user constraints (dietary, pets, accessibility, etc.) literally.

Respond ONLY with the structured output.`;

const NARRATIVE_PROMPT = `You are a senior travel planner. Given user constraints and live web data, produce ONLY: a trip overview, a total cost estimate, and the best hero image index. Keep it tight; this call gates first paint.

Rules:
- If the payload includes livePrices (real flight and hotel prices from a booking engine), your totalEstimate MUST be built on those real numbers: cheapest live flight total, plus a mid-range live hotel rate x nights, plus a realistic food/activities/local-transport allowance for this destination and party. Say in the breakdown which parts are live prices and which are estimated.
- Without livePrices, estimate conservatively from the Tavily sources.
- heroImageIndex: pick the single image index that best represents the destination.
- overview: 2-3 sentences, specific to this user and trip.

Respond ONLY with the structured output.`;

const ITINERARY_PROMPT = `You are a senior travel planner. Given user constraints and live web data, build the day-by-day itinerary and 3-5 insider tips. BE CONCISE: every description is one sentence of at most 18 words; the itinerary must render fast.

Rules:
- insiderTips: 3-5 specific non-generic tips ("avoid the metro at rush hour" beats "be respectful of local customs"); each at most 20 words.
- Exactly 3 activities per day.
- Exactly one entry per day of the trip, starting day 1.
- Each day has a theme and 3-4 activities spanning morning / afternoon / evening.
- Be specific — real place names, neighborhoods, restaurants. Never generic ("visit a museum" is bad; "Museu Nacional do Azulejo in Beato" is good).
- Align with the user's interests and vibe. "Hiking" → hiking features prominently. "Off-the-beaten-path" → avoid tourist traps.
- Use Tavily sources (especially "activities" and "tips" categories) to ground your recommendations in real places.
- Respect constraints (dietary, pets, accessibility) literally.
- Estimated cost can be a range or approximate (e.g. "~$25", "free", "$$$").

Respond ONLY with the structured output.`;

const GROUP_TRIPS_PROMPT = `You are a travel matcher. Invent exactly 3 plausible fake "group trips" — other travelers heading to the same destination around the same dates as the user — so the user can imagine joining them.

Rules:
- Hosts: realistic first + last initial format (e.g., "Maria L.", "James K."). Diverse names/backgrounds.
- hostOrigin: a real city different from the user's origin.
- hostVibe: one short phrase ("solo female traveler", "couple in their 30s", "friends from grad school", "digital nomads").
- Dates must OVERLAP the user's trip dates (±3 days is fine).
- travelersCount: 1-3; capacity: 2-6; travelersCount ≤ capacity.
- focus: 2-3 short interest tags that partly overlap with the user's interests.
- blurb: 1-2 sentences, specific and warm — what companions they're hoping for. Avoid generic ("looking for fun people").
- id: "grp-1", "grp-2", "grp-3".

Respond ONLY with the structured output.`;

const ActivitySchema = z.object({
  timeOfDay: z.enum(["morning", "afternoon", "evening"]),
  title: z.string(),
  description: z.string(),
  estimatedCost: z.string(),
});

const ItineraryDaySchema = z.object({
  day: z.number().int(),
  date: z.string(),
  theme: z.string(),
  activities: z.array(ActivitySchema),
});

const FlightSchema = z.object({
  airline: z.string(),
  approxPrice: z.number().int(),
  currency: z.string(),
  durationHours: z.number(),
  stops: z.number().int(),
  notes: z.string(),
  sourceIndex: z.number().int().nullable(),
});

const HotelSchema = z.object({
  name: z.string(),
  area: z.string(),
  approxPricePerNight: z.number().int(),
  currency: z.string(),
  ratingOutOf5: z.number(),
  highlights: z.array(z.string()),
  imageIndex: z.number().int().nullable(),
  sourceIndex: z.number().int().nullable(),
});

const GroupTripSchema = z.object({
  id: z.string(),
  hostName: z.string(),
  hostOrigin: z.string(),
  hostVibe: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  travelersCount: z.number().int(),
  capacity: z.number().int(),
  focus: z.array(z.string()),
  blurb: z.string(),
});

const NarrativeSchema = z.object({
  overview: z.string(),
  totalEstimate: z.object({
    amount: z.number().int(),
    currency: z.string(),
    breakdown: z.string(),
  }),
  heroImageIndex: z.number().int().nullable(),
});

const LogisticsBothSchema = z.object({
  flights: z.array(FlightSchema),
  hotels: z.array(HotelSchema),
});
const LogisticsFlightsSchema = z.object({ flights: z.array(FlightSchema) });
const LogisticsHotelsSchema = z.object({ hotels: z.array(HotelSchema) });

const ItineraryOutputSchema = z.object({
  itinerary: z.array(ItineraryDaySchema),
  insiderTips: z.array(z.string()),
});

const GroupTripsOutputSchema = z.object({
  groupTrips: z.array(GroupTripSchema),
});

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

// Deep-link to momondo's actual flight results page (route + dates + airline
// pre-filtered, sorted cheapest first) — the user lands directly on flight
// options matching the card instead of a generic search box. Falls back to a
// Google Flights query string when we can't resolve the city/airport to an
// IATA code.
function flightSearchUrl(
  origin: string,
  dest: string,
  airline: string,
  start: string,
  end: string,
): string {
  const originCode = toCityCode(origin);
  const destCode = toCityCode(dest);
  if (originCode && destCode) {
    const params = new URLSearchParams({ sort: "price_a" });
    const airlineCode = toAirlineCode(airline);
    if (airlineCode) {
      // momondo's airline filter syntax: fs=airlines=AF (or comma-separated for multiple)
      params.set("fs", `airlines=${airlineCode}`);
    }
    return `https://www.momondo.com/flight-search/${originCode}-${destCode}/${start}/${end}?${params.toString()}`;
  }
  const q = encodeURIComponent(
    `flights from ${origin} to ${dest} on ${airline} ${start} to ${end}`,
  );
  return `https://www.google.com/travel/flights?q=${q}`;
}

// Booking.com search prefilled with hotel name + destination + dates +
// party size. The dates + party size are the load-bearing fields: even if
// our suggested hotel name doesn't exist on Booking (LLM occasionally
// invents one), the user still lands on a page of REAL hotels actually
// available for their date range and group size — never a dead end. If
// the hotel does exist, Booking's fuzzy search surfaces it at the top.
function hotelSearchUrl(
  name: string,
  dest: string,
  start: string,
  end: string,
  travelers: number,
): string {
  const params = new URLSearchParams({
    ss: `${name}, ${dest}`,
    checkin: start,
    checkout: end,
    group_adults: String(Math.max(1, travelers)),
    no_rooms: travelers >= 5 ? "2" : "1",
    group_children: "0",
  });
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

export async function POST(req: Request): Promise<Response> {
  const rl = rateLimit(`trip:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return Response.json(
      {
        ok: false,
        error: "Too many trip plans — please wait a minute and try again.",
      } satisfies TripDetailsResponse,
      { status: 429 },
    );
  }

  let input;
  try {
    input = TripDetailsInputSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join("; ")
        : "Invalid input";
    return Response.json(
      { ok: false, error: message } satisfies TripDetailsResponse,
      { status: 400 },
    );
  }

  if (isMockMode()) {
    await mockDelay(1800);
    return Response.json(mockTripDetails(input));
  }

  if (!process.env.ANTHROPIC_API_KEY || !process.env.TAVILY_API_KEY) {
    return Response.json(
      { ok: false, error: "Missing API keys." } satisfies TripDetailsResponse,
      { status: 500 },
    );
  }

  const nights = Math.max(1, daysBetween(input.startDate, input.endDate));
  const destFull = `${input.name}, ${input.country}`;
  const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

  const monthName = new Date(input.startDate).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });
  const queries = [
    `flights from ${input.origin} to ${destFull} ${input.startDate} price airlines`,
    `best hotels in ${destFull} ${input.startDate} to ${input.endDate} under ${Math.round(input.budget / nights / 2)} ${input.currency} per night`,
    `top things to do in ${destFull} ${input.interests.slice(0, 3).join(", ")}`,
    `${destFull} travel tips insider local ${input.interests[0] ?? "food"}`,
    `${input.name} hotel prices per night ${monthName}`,
  ];

  // Tolerate individual search failures: a trip plan with three of four
  // categories beats a 502. Only fail when every query failed.
  const settledSearches = await Promise.allSettled(
    queries.map((q) =>
      tavilyClient.search(q, {
        searchDepth: "basic",
        maxResults: 4,
        includeImages: true,
        includeImageDescriptions: true,
        includeAnswer: false,
      }),
    ),
  );
  const results = settledSearches
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (results.length === 0) {
    const firstErr = settledSearches[0];
    return Response.json(
      {
        ok: false,
        error: `Search failed: ${
          firstErr.status === "rejected" && firstErr.reason instanceof Error
            ? firstErr.reason.message
            : "all search queries failed"
        }`,
      } satisfies TripDetailsResponse,
      { status: 502 },
    );
  }

  const seenUrls = new Set<string>();
  const sources: { title: string; url: string; content: string; category: string }[] = [];
  const labels = ["flights", "hotels", "activities", "tips", "hotel-prices"];
  const fulfilledLabels = settledSearches
    .map((r, i) => (r.status === "fulfilled" ? labels[i] : null))
    .filter((l): l is string => l !== null);
  results.forEach((r, idx) => {
    for (const item of r.results ?? []) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        sources.push({
          title: item.title,
          url: item.url,
          content: item.content?.slice(0, 1000) ?? "",
          category: fulfilledLabels[idx] ?? "tips",
        });
      }
    }
  });

  const seenImages = new Set<string>();
  const images: { url: string; description: string }[] = [];
  for (const r of results) {
    for (const img of r.images ?? []) {
      if (!seenImages.has(img.url)) {
        seenImages.add(img.url);
        images.push({ url: img.url, description: img.description ?? "" });
      }
    }
  }

  const payload = {
    trip: {
      destination: destFull,
      origin: input.origin,
      dates: { start: input.startDate, end: input.endDate, nights },
      budget: { amount: input.budget, currency: input.currency },
      travelers: input.travelers,
      interests: input.interests,
      vibe: input.vibe || null,
      constraints: input.constraints || null,
    },
    sources: sources.map((s, i) => ({
      index: i,
      category: s.category,
      title: s.title,
      excerpt: s.content,
    })),
    images: images.map((img, i) => ({ index: i, description: img.description })),
  };

  const userContent = `Use the live search data below.\n\n${JSON.stringify(payload)}`;

  const anthropic = new Anthropic();

  // Kick off Travelpayouts searches in parallel with Claude. They're much
  // faster (1-3s) than Claude (~25s), so by the time core resolves, real
  // flight + hotel data is usually already in. If TP returns empty (city
  // unknown to Aviasales / no token / network issue), we fall back to
  // Claude's LLM-generated estimates.
  // The price ladder, cleanest source first:
  //   1. SerpAPI (real Google Flights/Hotels results, needs SERPAPI_KEY)
  //   2. Direct Google fallback (free, best-effort, kill switch
  //      GOOGLE_TRAVEL_FALLBACK=off)
  //   3. Callers fall through to the deterministic model + clamped LLM.
  const tpFlightsPromise: Promise<FlightOption[]> = (async () => {
    if (serpapiConfigured()) {
      const f = await searchFlightsSerp(
        input.origin, destFull, input.startDate, input.endDate,
        input.currency, input.travelers,
      ).catch(() => [] as FlightOption[]);
      if (f.length > 0) return f;
    }
    return searchFlightsGoogle(
      input.origin, destFull, input.startDate, input.endDate,
      input.currency, input.travelers,
    ).catch(() => [] as FlightOption[]);
  })();

  const tpHotelsPromise: Promise<HotelOption[]> = (async () => {
    if (serpapiConfigured()) {
      const h = await searchHotelsSerp(
        destFull, input.startDate, input.endDate,
        input.travelers, input.currency,
      ).catch(() => [] as HotelOption[]);
      if (h.length > 0) return h;
    }
    return searchHotelsGoogle(
      destFull, input.startDate, input.endDate,
      input.travelers, input.currency,
    ).catch(() => [] as HotelOption[]);
  })();


  // Stream three independent Claude calls. As each one returns, the client
  // gets that section right away — so the page renders the moment "core"
  // (overview/hotels/flights/tips) lands instead of waiting for the
  // slowest call (typically itinerary).
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("ping", { stage: "synthesizing" });

      // Mock-derived sections don't depend on Claude — ship them
      // immediately so the page can render the moment core arrives.
      // Group trips ship as mocks too: the section is explicitly a
      // demo of what real matchmaking would look like, so showing
      // three plausible deterministic mockups (a) saves a Claude call,
      // (b) keeps the section populated reliably, (c) makes the
      // feature's vision visible from the first paint.
      send("base", {
        reviews: mockReviews(input),
        events: mockEvents(input),
        budgetBreakdown: mockBudgetBreakdown(input),
        transportation: mockTransportation(input),
        thingsToDo: mockThingsToDo(input),
        restaurants: mockRestaurants(input),
        groupTrips: mockGroupTrips(input),
      });

      // Real prices first: wait briefly for Travelpayouts so the model
      // calls can (a) skip sections we already have live data for and
      // (b) ground the total estimate in real numbers. Bounded so a slow
      // TP never delays the page by more than ~2.5s.
      const withTimeout = <T,>(pr: Promise<T>, ms: number, fallback: T): Promise<T> =>
        Promise.race([
          pr,
          new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
        ]);
      const [tpFlights, tpHotels, fareAnchor] = await Promise.all([
        withTimeout(tpFlightsPromise, 4500, [] as FlightOption[]),
        withTimeout(tpHotelsPromise, 4500, [] as HotelOption[]),
        estimateFlightTotal(
          input.origin,
          destFull,
          input.startDate,
          input.travelers,
          input.currency,
        ).catch(() => null),
      ]);
      // Prefer prices actually observed on the web this month (aggregator
      // search snippets) over the static country tier; the tier remains the
      // fallback when the harvest finds too few plausible figures.
      const harvested = harvestNightlyPrices(
        sources
          .filter((s) => s.category === "hotel-prices" || s.category === "hotels")
          .map((s) => `${s.title} ${s.content}`),
        input.currency,
      );
      const tierAnchor = estimateHotelNight(
        input.country,
        input.travelers,
        input.currency,
      );
      const roomFactor = input.travelers >= 5 ? 2 : input.travelers >= 3 ? 1.25 : 1;
      const hotelAnchor = harvested
        ? Math.round((harvested.perNight * roomFactor) / 5) * 5
        : tierAnchor;
      const needFlights = tpFlights.length === 0;
      const needHotels = tpHotels.length === 0;

      // One retry on transient model failures.
      const parseWithRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
        try {
          return await fn();
        } catch {
          return await fn();
        }
      };

      const narrativePayload = {
        ...payload,
        // Deterministic distance-and-season model, for grounding the total
        // when no live prices exist. Not a live quote.
        modelledPriceAnchor: fareAnchor
          ? {
              roundTripFlightTotalForGroup: fareAnchor.amount,
              typicalHotelPerNightForGroup: hotelAnchor,
              currency: fareAnchor.currency,
              note: harvested
                ? "flight from distance-and-season model; hotel median observed in current web prices"
                : "distance-and-season model, not a live quote",
            }
          : null,
        livePrices:
          tpFlights.length > 0 || tpHotels.length > 0
            ? {
                flights: tpFlights.slice(0, 3).map((f) => ({
                  airline: f.airline,
                  totalPriceForAllTravelersRoundTrip: f.approxPrice,
                  currency: f.currency,
                  stops: f.stops,
                })),
                note: `Flight prices above are ALREADY the round-trip total for all ${input.travelers} traveler(s) combined. Do NOT multiply them by travelers again.`,
                hotelsPerNight: tpHotels.slice(0, 5).map((h) => ({
                  name: h.name,
                  pricePerNight: h.approxPricePerNight,
                  currency: h.currency,
                })),
              }
            : null,
      };

      const narrativePromise = parseWithRetry(() =>
        anthropic.messages.parse({
          model: "claude-sonnet-5",
          max_tokens: 900,
          output_config: { format: zodOutputFormat(NarrativeSchema) },
          system: [
            { type: "text", text: NARRATIVE_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [
            {
              role: "user",
              content: `Use the live search data below.\n\n${JSON.stringify(narrativePayload)}`,
            },
          ],
        }),
      );

      // Only ask the model for logistics sections Travelpayouts could not
      // supply. When both are live, skip the call entirely.
      const logisticsSchema = needFlights && needHotels
        ? LogisticsBothSchema
        : needFlights
          ? LogisticsFlightsSchema
          : LogisticsHotelsSchema;
      const logisticsPromise: Promise<{
        flights?: z.infer<typeof FlightSchema>[];
        hotels?: z.infer<typeof HotelSchema>[];
      } | null> =
        needFlights || needHotels
          ? parseWithRetry(() =>
              anthropic.messages.parse({
                model: "claude-sonnet-5",
                max_tokens: 3200,
                output_config: { format: zodOutputFormat(logisticsSchema) },
                system: [
                  {
                    type: "text",
                    text: LOGISTICS_PROMPT,
                    cache_control: { type: "ephemeral" },
                  },
                ],
                messages: [{ role: "user", content: userContent }],
              }),
            ).then((res) => res.parsed_output as {
              flights?: z.infer<typeof FlightSchema>[];
              hotels?: z.infer<typeof HotelSchema>[];
            } | null).catch((err) => {
              console.error("[trip-details] logistics call failed:", err instanceof Error ? err.message : err);
              return null;
            })
          : Promise.resolve(null);

      const corePromise = Promise.all([narrativePromise, logisticsPromise]).then(
        ([narrativeRes, logistics]) => {
          const core = narrativeRes.parsed_output;
          if (!core) throw new Error("Empty narrative response");

          const flights: FlightOption[] =
            tpFlights.length > 0
              ? tpFlights
              : [...(logistics?.flights ?? [])]
                  .sort((a, b) => a.approxPrice - b.approxPrice)
                  .map((f) => ({
                    airline: f.airline,
                    approxPrice: clampToEstimate(
                      f.approxPrice,
                      fareAnchor?.amount ?? null,
                    ),
                    currency: f.currency,
                    durationHours: f.durationHours,
                    stops: f.stops,
                    notes: f.notes,
                    bookingUrl: flightSearchUrl(
                      input.origin,
                      destFull,
                      f.airline,
                      input.startDate,
                      input.endDate,
                    ),
                  }));

          const hotels: HotelOption[] =
            tpHotels.length > 0
              ? tpHotels
              : (logistics?.hotels ?? []).map((h) => ({
                  name: h.name,
                  area: h.area,
                  approxPricePerNight: clampToEstimate(
                    h.approxPricePerNight,
                    hotelAnchor,
                    0.5,
                    2.2,
                  ),
                  currency: h.currency,
                  ratingOutOf5: h.ratingOutOf5,
                  highlights: h.highlights,
                  bookingUrl: hotelSearchUrl(
                    h.name,
                    destFull,
                    input.startDate,
                    input.endDate,
                    input.travelers,
                  ),
                  imageUrl:
                    h.imageIndex !== null &&
                    h.imageIndex >= 0 &&
                    h.imageIndex < images.length
                      ? images[h.imageIndex].url
                      : null,
                }));

          // Budget breakdown from the REAL numbers on this page, so the
          // chart can never contradict the flight and hotel cards above it.
          const cheapestFlight = flights.length > 0 ? flights[0].approxPrice : null;
          const midHotel =
            hotels.length > 0
              ? [...hotels].sort(
                  (a, b) => a.approxPricePerNight - b.approxPricePerNight,
                )[Math.floor(hotels.length / 2)].approxPricePerNight
              : null;
          const flightsAmt = cheapestFlight ?? Math.round(core.totalEstimate.amount * 0.35);
          const lodgingAmt = (midHotel ?? Math.round((core.totalEstimate.amount * 0.3) / nights)) * nights;
          const rest = Math.max(0, core.totalEstimate.amount - flightsAmt - lodgingAmt);
          const bd = {
            currency: core.totalEstimate.currency,
            total: flightsAmt + lodgingAmt + rest,
            perPerson: Math.round((flightsAmt + lodgingAmt + rest) / Math.max(1, input.travelers)),
            items: [
              {
                category: "flights" as const,
                amount: flightsAmt,
                note: cheapestFlight
                  ? "Cheapest live round-trip fare shown above"
                  : "Modelled estimate",
              },
              {
                category: "lodging" as const,
                amount: lodgingAmt,
                note: midHotel
                  ? `Mid-range live rate x ${nights} nights`
                  : "Modelled estimate",
              },
              { category: "food" as const, amount: Math.round(rest * 0.45), note: "Allowance" },
              { category: "activities" as const, amount: Math.round(rest * 0.3), note: "Allowance" },
              { category: "transport" as const, amount: Math.round(rest * 0.15), note: "Local transit allowance" },
              { category: "misc" as const, amount: Math.round(rest * 0.1), note: "Buffer" },
            ],
          };

          send("core", {
            budgetBreakdown: bd,
            heroImage:
              core.heroImageIndex !== null &&
              core.heroImageIndex >= 0 &&
              core.heroImageIndex < images.length
                ? images[core.heroImageIndex]?.url ?? null
                : images[0]?.url ?? null,
            overview: core.overview,
            insiderTips: [],
            totalEstimate: core.totalEstimate,
            flights,
            hotels,
          });
        },
      );

      // Itinerary is list assembly, not judgment: the fast model with a
      // brevity contract beats the big model taking 45 seconds.
      const itineraryPromise = parseWithRetry(() =>
        anthropic.messages.parse({
          model: "claude-haiku-4-5",
          max_tokens: 4000,
          output_config: { format: zodOutputFormat(ItineraryOutputSchema) },
          system: [
            { type: "text", text: ITINERARY_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userContent }],
        }),
      )
        .then((res) => {
          const itinerary = res.parsed_output;
          if (!itinerary) throw new Error("Empty itinerary response");
          send("itinerary", {
            itinerary: itinerary.itinerary,
            insiderTips: itinerary.insiderTips ?? [],
          });
        })
        .catch((err) => {
          console.error(
            "[trip-details] itinerary failed:",
            err instanceof Error ? err.message : err,
          );
          // Tell the client to stop the spinner; the rest of the page works.
          send("itinerary", { itinerary: [], insiderTips: [] });
          throw err;
        });

      const settled = await Promise.allSettled([corePromise, itineraryPromise]);

      // Surface failures, but only fail the whole stream if core didn't land —
      // itinerary/groupTrips degrade gracefully (sections show "unavailable").
      const coreResult = settled[0];
      if (coreResult.status === "rejected") {
        const message =
          coreResult.reason instanceof Error
            ? coreResult.reason.message
            : "Planning failed";
        send("error", { message });
      }
      send("done", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "content-encoding": "identity",
    },
  });
}
