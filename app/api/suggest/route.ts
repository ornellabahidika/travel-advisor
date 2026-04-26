import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { tavily } from "@tavily/core";
import { z } from "zod";
import { buildSearchQueries } from "@/lib/queries";
import { isMockMode, mockDelay, mockSuggest } from "@/lib/mocks";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { TravelInputSchema, type Destination, type SuggestResponse } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert travel advisor with three jobs.

1. REASONING: Use the live web-search results to recommend 4-5 destinations that genuinely match the user's constraints. Quality > quantity. Reject destinations that don't actually fit, even if they're popular.

2. CONSTRAINT-SOLVING: Take the user's "constraints" field literally and seriously. If they say "I have a cat", "vegetarian", or "need wifi", let that drive ranking — don't ignore weird constraints.

3. COUNTER-SUGGEST: For at least 1-2 destinations, offer a "counter-suggestion" — a less-obvious alternative that may actually serve the user better (cheaper, less crowded, better fit). Be specific about WHY.

For EACH destination, you MUST also provide:
- flightEstimate: Approximate round-trip flight cost as a GROUP TOTAL for the stated number of travelers (per-person × travelers). Name a real airline that flies this route (e.g., "Delta", "Air France", "Emirates"). If search results mention per-person prices, multiply by travelers. Otherwise estimate conservatively.
- hotelNightEstimate: Approximate nightly accommodation cost for the group. 1-2 travelers: one standard room. 3-4: one larger room or two standard. 5+: likely two rooms or an apartment rental — adjust accordingly.

You must:
- Only cite source indices that exist in the provided "sources" array.
- Only reference image indices that exist in the provided "images" array.
- Pick images that visually represent the destination (use the description field).
- Make matchScore reflect actual fit (50-100 range; 95+ = exceptional fit).
- liveSignals should be concrete, current facts: weather right now, ongoing festival, recent visa change, current safety advisory, price trend. Not generic.
- Keep whyItMatches to 2-3 sentences. Specific to this user's input.
- vibe is a single evocative phrase capturing the feeling.
- estimatedCost should reflect total trip cost for the trip duration in the user's currency.
- counterSuggestion can be null if you genuinely have nothing better to offer.

Respond ONLY with the structured output. No preamble.`;

const DestinationFromAI = z.object({
  name: z.string(),
  country: z.string(),
  matchScore: z.number().int(),
  whyItMatches: z.string(),
  vibe: z.string(),
  liveSignals: z.array(z.string()),
  counterSuggestion: z
    .object({
      name: z.string(),
      reason: z.string(),
    })
    .nullable(),
  estimatedCost: z.object({
    amount: z.number().int(),
    currency: z.string(),
    note: z.string(),
  }),
  bestTimeNote: z.string(),
  flightEstimate: z.object({
    amount: z.number().int(),
    currency: z.string(),
    airline: z.string(),
  }),
  hotelNightEstimate: z.object({
    amount: z.number().int(),
    currency: z.string(),
  }),
  sourceIndices: z.array(z.number().int()),
  imageIndices: z.array(z.number().int()),
});

const SuggestSchema = z.object({
  reasoning: z.string(),
  destinations: z.array(DestinationFromAI),
});

export async function POST(req: Request): Promise<Response> {
  const rl = rateLimit(`suggest:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return Response.json(
      {
        ok: false,
        error: "Too many searches — please wait a minute and try again.",
      } satisfies SuggestResponse,
      { status: 429 },
    );
  }

  let input;
  try {
    const body = await req.json();
    input = TravelInputSchema.parse(body);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join("; ")
        : "Invalid input";
    return Response.json({ ok: false, error: message } satisfies SuggestResponse, {
      status: 400,
    });
  }

  if (isMockMode()) {
    await mockDelay(1200);
    return Response.json(mockSuggest(input));
  }

  if (!process.env.ANTHROPIC_API_KEY || !process.env.TAVILY_API_KEY) {
    return Response.json(
      {
        ok: false,
        error: "Missing API keys. Set ANTHROPIC_API_KEY and TAVILY_API_KEY in .env.local.",
      } satisfies SuggestResponse,
      { status: 500 },
    );
  }

  const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const queries = buildSearchQueries(input);

  let searchResults;
  try {
    searchResults = await Promise.all(
      queries.slice(0, 3).map((q) =>
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
        error: `Tavily search failed: ${err instanceof Error ? err.message : "unknown"}`,
      } satisfies SuggestResponse,
      { status: 502 },
    );
  }

  const seenUrls = new Set<string>();
  const sources: { title: string; url: string; content: string }[] = [];
  for (const r of searchResults) {
    for (const item of r.results ?? []) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        sources.push({
          title: item.title,
          url: item.url,
          content: item.content?.slice(0, 1200) ?? "",
        });
      }
    }
  }

  const seenImageUrls = new Set<string>();
  const images: { url: string; description: string }[] = [];
  for (const r of searchResults) {
    for (const img of r.images ?? []) {
      if (!seenImageUrls.has(img.url)) {
        seenImageUrls.add(img.url);
        images.push({ url: img.url, description: img.description ?? "" });
      }
    }
  }

  if (sources.length === 0) {
    return Response.json(
      {
        ok: false,
        error: "No search results found. Try broader interests or a different date range.",
      } satisfies SuggestResponse,
      { status: 404 },
    );
  }

  const userPayload = {
    request: {
      origin: input.origin,
      dates: { start: input.startDate, end: input.endDate },
      budget: { amount: input.budget, currency: input.currency },
      travelers: input.travelers,
      climate: input.climate,
      interests: input.interests,
      vibe: input.vibe || null,
      constraints: input.constraints || null,
    },
    sources: sources.map((s, i) => ({
      index: i,
      title: s.title,
      url: s.url,
      excerpt: s.content,
    })),
    images: images.map((img, i) => ({
      index: i,
      description: img.description,
    })),
  };

  const anthropic = new Anthropic();

  let parsed;
  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-4-7",
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: {
        format: zodOutputFormat(SuggestSchema),
        effort: "medium",
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Here is the user's travel request and the live web data I gathered. Recommend 4-5 destinations.\n\n${JSON.stringify(userPayload)}`,
        },
      ],
    });

    parsed = response.parsed_output;
    if (!parsed) {
      return Response.json(
        { ok: false, error: "Model returned no structured output." } satisfies SuggestResponse,
        { status: 502 },
      );
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { ok: false, error: `Claude API error (${err.status}): ${err.message}` } satisfies SuggestResponse,
        { status: 502 },
      );
    }
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Synthesis failed",
      } satisfies SuggestResponse,
      { status: 500 },
    );
  }

  const destinations: Destination[] = parsed.destinations.map((d) => {
    const cardImages = d.imageIndices
      .filter((i) => i >= 0 && i < images.length)
      .slice(0, 4)
      .map((i) => ({
        url: images[i].url,
        alt: images[i].description || `${d.name}, ${d.country}`,
      }));

    const cardSources = d.sourceIndices
      .filter((i) => i >= 0 && i < sources.length)
      .slice(0, 5)
      .map((i) => ({ title: sources[i].title, url: sources[i].url }));

    return {
      name: d.name,
      country: d.country,
      matchScore: Math.max(0, Math.min(100, d.matchScore)),
      whyItMatches: d.whyItMatches,
      vibe: d.vibe,
      liveSignals: d.liveSignals,
      counterSuggestion: d.counterSuggestion ?? undefined,
      estimatedCost: d.estimatedCost,
      bestTimeNote: d.bestTimeNote,
      flightEstimate: d.flightEstimate,
      hotelNightEstimate: d.hotelNightEstimate,
      images: cardImages,
      sources: cardSources,
    };
  });

  return Response.json({
    ok: true,
    destinations,
    reasoning: parsed.reasoning,
  } satisfies SuggestResponse);
}
