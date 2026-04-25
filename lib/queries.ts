import type { TravelInput } from "./types";

export function buildSearchQueries(input: TravelInput): string[] {
  const start = new Date(input.startDate);
  const month = start.toLocaleString("en-US", { month: "long" });
  const year = start.getFullYear();
  const topInterests = input.interests.slice(0, 3).join(", ");
  const climate = input.climate === "any" ? "" : `${input.climate} climate`;
  const vibePart = input.vibe.trim();

  const queries = [
    `best ${climate} travel destinations ${month} ${year} for ${topInterests}`,
    `affordable trips from ${input.origin} ${month} ${year} budget ${input.budget} ${input.currency} ${topInterests}`,
    `unique off the beaten path destinations ${month} ${year} ${topInterests} ${climate}`.trim(),
  ];

  if (vibePart) {
    queries.push(
      `${vibePart} travel destinations ${month} ${year} where to go`,
    );
  } else {
    queries.push(
      `${input.interests[0] ?? "travel"} destinations ${month} ${year} weather visa safety`,
    );
  }

  return queries.map((q) => q.replace(/\s+/g, " ").trim());
}
