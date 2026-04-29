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

// destinations comes BEFORE reasoning in the schema so Claude emits the
// first card almost immediately — reasoning is a long block that would
// otherwise delay time-to-first-result by several seconds.
const SuggestSchema = z.object({
  destinations: z.array(DestinationFromAI),
  reasoning: z.string(),
});

// Walk the streamed JSON buffer and pull out completed objects from the
// top-level "destinations": [...] array. Brace-counts with full awareness
// of strings and escape sequences, so braces inside string literals don't
// confuse the depth tracker.
function extractCompletedDestinations(
  buffer: string,
  cursor: number,
): { newObjectStrings: string[]; nextCursor: number; arrayStarted: boolean } {
  const arrayMarker = /"destinations"\s*:\s*\[/;
  const m = buffer.match(arrayMarker);
  if (!m || m.index === undefined) {
    return { newObjectStrings: [], nextCursor: cursor, arrayStarted: false };
  }
  const arrayContentStart = m.index + m[0].length;
  let i = Math.max(cursor, arrayContentStart);

  const newObjects: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let objectStart = -1;
  let lastClosedAt = i;

  while (i < buffer.length) {
    const ch = buffer[i];
    if (escape) {
      escape = false;
    } else if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        newObjects.push(buffer.slice(objectStart, i + 1));
        objectStart = -1;
        lastClosedAt = i + 1;
      }
    } else if (ch === "]" && depth === 0) {
      break;
    }
    i++;
  }

  return {
    newObjectStrings: newObjects,
    nextCursor: lastClosedAt,
    arrayStarted: true,
  };
}

function mapDestination(
  d: z.infer<typeof DestinationFromAI>,
  sources: { title: string; url: string; content: string }[],
  images: { url: string; description: string }[],
): Destination {
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
}

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
    const tavilyTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tavily timed out after 25s")), 25_000),
    );
    searchResults = (await Promise.race([
      Promise.all(
        queries.slice(0, 2).map((q) =>
          tavilyClient.search(q, {
            searchDepth: "basic",
            maxResults: 3,
            includeImages: true,
            includeImageDescriptions: true,
            includeAnswer: false,
          }),
        ),
      ),
      tavilyTimeout,
    ])) as Awaited<ReturnType<typeof tavilyClient.search>>[];
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
          content: item.content?.slice(0, 700) ?? "",
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
    sources: sources.slice(0, 12).map((s, i) => ({
      index: i,
      title: s.title,
      url: s.url,
      excerpt: s.content,
    })),
    images: images.slice(0, 16).map((img, i) => ({
      index: i,
      description: img.description,
    })),
  };

  const anthropic = new Anthropic();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // Tell the client we're alive immediately. Also forces the response
        // headers to flush so the browser doesn't sit on an empty stream
        // until the first real event arrives.
        send("ping", { stage: "synthesizing" });

        const claudeStream = anthropic.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 4096,
          output_config: {
            format: zodOutputFormat(SuggestSchema),
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

        let buffer = "";
        let cursor = 0;
        let emitted = 0;

        for await (const event of claudeStream) {
          if (event.type !== "content_block_delta") continue;
          // Structured output (output_config + zodOutputFormat) streams as
          // input_json_delta with partial_json chunks. Plain text mode would
          // stream text_delta. Handle both so we don't get caught out if the
          // SDK shape shifts.
          let chunk = "";
          const delta = event.delta as {
            type?: string;
            text?: string;
            partial_json?: string;
          };
          if (delta?.type === "input_json_delta" && delta.partial_json) {
            chunk = delta.partial_json;
          } else if (delta?.type === "text_delta" && delta.text) {
            chunk = delta.text;
          }
          if (!chunk) continue;
          buffer += chunk;
          const { newObjectStrings, nextCursor } = extractCompletedDestinations(
            buffer,
            cursor,
          );
          cursor = nextCursor;
          for (const objStr of newObjectStrings) {
            try {
              const parsed = DestinationFromAI.parse(JSON.parse(objStr));
              const mapped = mapDestination(parsed, sources, images);
              send("destination", { destination: mapped, index: emitted });
              emitted++;
            } catch {
              // Skip objects that don't match (rare — Claude sometimes
              // emits malformed JSON on the first attempt before recovering).
            }
          }
        }

        const finalMessage = await claudeStream.finalMessage();
        const parsed = finalMessage.parsed_output as
          | z.infer<typeof SuggestSchema>
          | undefined;
        send("done", {
          reasoning: parsed?.reasoning ?? "",
          totalCount: emitted,
        });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Synthesis failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Tell Vercel/upstream proxies not to buffer the SSE response.
      // Without this, gzip + edge buffering can hold all events until
      // the response closes, defeating streaming entirely.
      "x-accel-buffering": "no",
      "content-encoding": "identity",
    },
  });
}
