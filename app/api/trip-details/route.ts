import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { tavily } from "@tavily/core";
import { z } from "zod";
import {
  isMockMode,
  mockBudgetBreakdown,
  mockDelay,
  mockEvents,
  mockRestaurants,
  mockReviews,
  mockThingsToDo,
  mockTransportation,
  mockTripDetails,
} from "@/lib/mocks";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import {
  TripDetailsInputSchema,
  type TripDetails,
  type TripDetailsResponse,
} from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const CORE_PROMPT = `You are a senior travel planner. Given user constraints and live web data, produce the trip's core: overview, total estimated cost, 3-5 flight options (sorted cheapest first), 3-5 hotel options that fit the budget, 3-5 insider tips, and the best hero image index.

Rules:
- Use the Tavily sources (categories "flights", "hotels", "activities", "tips") as ground truth for prices, airline names, hotel names, neighborhoods. Estimate conservatively when exact prices are missing.
- Flights: prices are GROUP TOTAL for the stated number of travelers (per-person × travelers). Sort cheapest first. For each, set sourceIndex to the index of the Tavily "flights" source that best matches (for the "Book" link). Null if no good match.
- Hotels: must fit within roughly (budget - flights) / nights per night for the group. 1-2 travelers: one standard room. 3-4: one larger room, family room, or two standard. 5+: two rooms or apartment rental. Mention occupancy in highlights where relevant. For each, set sourceIndex to the best Tavily "hotels" source. imageIndex = index in the images array that visually represents the hotel, or null.
- insiderTips: 3-5 specific non-generic tips ("avoid the metro at rush hour" beats "be respectful of local customs").
- heroImageIndex: pick the single image index that best represents the destination.
- Respect the user's constraints (dietary, pets, accessibility, etc.) literally.

Respond ONLY with the structured output.`;

const ITINERARY_PROMPT = `You are a senior travel planner. Given user constraints and live web data, build ONLY the day-by-day itinerary.

Rules:
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

const CoreSchema = z.object({
  overview: z.string(),
  insiderTips: z.array(z.string()),
  flights: z.array(FlightSchema),
  hotels: z.array(HotelSchema),
  totalEstimate: z.object({
    amount: z.number().int(),
    currency: z.string(),
    breakdown: z.string(),
  }),
  heroImageIndex: z.number().int().nullable(),
});

const ItineraryOutputSchema = z.object({
  itinerary: z.array(ItineraryDaySchema),
});

const GroupTripsOutputSchema = z.object({
  groupTrips: z.array(GroupTripSchema),
});

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

// Build a per-flight Google Flights URL that includes the specific airline
// shown on the card. Previously we fell back to LLM-picked Tavily source URLs
// which often pointed at "best flights" listicles rather than the actual
// carrier — making the Book button mismatched with what the user sees.
function flightSearchUrl(
  origin: string,
  dest: string,
  airline: string,
  start: string,
  end: string,
): string {
  const q = encodeURIComponent(
    `flights from ${origin} to ${dest} on ${airline} ${start} to ${end}`,
  );
  return `https://www.google.com/travel/flights?q=${q}`;
}

// Booking.com search prefilled with the specific hotel name + destination +
// dates. Searching the hotel name first makes the actual property the top
// result on Booking.com (or surfaces close matches if the exact one isn't
// listed). Using this for ALL hotels (not just when the LLM had no source)
// keeps the Book link tied to the card.
function hotelSearchUrl(name: string, dest: string, start: string, end: string): string {
  const params = new URLSearchParams({
    ss: `${name} ${dest}`,
    checkin: start,
    checkout: end,
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

  const queries = [
    `flights from ${input.origin} to ${destFull} ${input.startDate} price airlines`,
    `best hotels in ${destFull} ${input.startDate} to ${input.endDate} under ${Math.round(input.budget / nights / 2)} ${input.currency} per night`,
    `top things to do in ${destFull} ${input.interests.slice(0, 3).join(", ")}`,
    `${destFull} travel tips insider local ${input.interests[0] ?? "food"}`,
  ];

  let results;
  try {
    results = await Promise.all(
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
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Search failed: ${err instanceof Error ? err.message : "unknown"}`,
      } satisfies TripDetailsResponse,
      { status: 502 },
    );
  }

  const seenUrls = new Set<string>();
  const sources: { title: string; url: string; content: string; category: string }[] = [];
  const labels = ["flights", "hotels", "activities", "tips"];
  results.forEach((r, idx) => {
    for (const item of r.results ?? []) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        sources.push({
          title: item.title,
          url: item.url,
          content: item.content?.slice(0, 1000) ?? "",
          category: labels[idx],
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
      send("base", {
        reviews: mockReviews(input),
        events: mockEvents(input),
        budgetBreakdown: mockBudgetBreakdown(input),
        transportation: mockTransportation(input),
        thingsToDo: mockThingsToDo(input),
        restaurants: mockRestaurants(input),
      });

      const corePromise = anthropic.messages
        .parse({
          model: "claude-haiku-4-5",
          max_tokens: 4096,
          output_config: { format: zodOutputFormat(CoreSchema) },
          system: [
            { type: "text", text: CORE_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userContent }],
        })
        .then((res) => {
          const core = res.parsed_output;
          if (!core) throw new Error("Empty core response");
          send("core", {
            heroImage:
              core.heroImageIndex !== null && core.heroImageIndex < images.length
                ? images[core.heroImageIndex]?.url ?? null
                : images[0]?.url ?? null,
            overview: core.overview,
            insiderTips: core.insiderTips,
            totalEstimate: core.totalEstimate,
            flights: [...core.flights]
              .sort((a, b) => a.approxPrice - b.approxPrice)
              .map((f) => ({
                airline: f.airline,
                approxPrice: f.approxPrice,
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
              })),
            hotels: core.hotels.map((h) => ({
              name: h.name,
              area: h.area,
              approxPricePerNight: h.approxPricePerNight,
              currency: h.currency,
              ratingOutOf5: h.ratingOutOf5,
              highlights: h.highlights,
              bookingUrl: hotelSearchUrl(
                h.name,
                destFull,
                input.startDate,
                input.endDate,
              ),
              imageUrl:
                h.imageIndex !== null &&
                h.imageIndex >= 0 &&
                h.imageIndex < images.length
                  ? images[h.imageIndex].url
                  : null,
            })),
          });
        });

      const itineraryPromise = anthropic.messages
        .parse({
          model: "claude-haiku-4-5",
          max_tokens: 4096,
          output_config: { format: zodOutputFormat(ItineraryOutputSchema) },
          system: [
            { type: "text", text: ITINERARY_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userContent }],
        })
        .then((res) => {
          const itinerary = res.parsed_output;
          if (!itinerary) throw new Error("Empty itinerary response");
          send("itinerary", { itinerary: itinerary.itinerary });
        });

      const groupTripsPromise = anthropic.messages
        .parse({
          model: "claude-haiku-4-5",
          max_tokens: 1500,
          output_config: { format: zodOutputFormat(GroupTripsOutputSchema) },
          system: [
            { type: "text", text: GROUP_TRIPS_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userContent }],
        })
        .then((res) => {
          const gt = res.parsed_output;
          if (!gt) throw new Error("Empty group trips response");
          send("groupTrips", { groupTrips: gt.groupTrips });
        });

      const settled = await Promise.allSettled([
        corePromise,
        itineraryPromise,
        groupTripsPromise,
      ]);

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
