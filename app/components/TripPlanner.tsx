"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Plane,
  Hotel,
  MapPin,
  Lightbulb,
  Sunrise,
  Sun,
  Moon,
  ExternalLink,
  Loader2,
  Star,
  Calendar,
  Wallet,
  Users,
  X,
  Send,
  MessageSquare,
  Ticket,
  Music,
  Palette,
  Utensils,
  Trophy,
  PartyPopper,
  Drama,
  Landmark,
  Bus,
  MoreHorizontal,
  Train,
  Bike,
  CarTaxiFront,
  Car,
  Footprints,
  CheckCircle2,
  Compass,
  Clock,
  Plus,
  Minus,
  Trash2,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import type {
  BudgetBreakdown,
  BudgetCategory,
  GroupTrip,
  JoinRequest,
  LocalEvent,
  Review,
  ReviewSummary as ReviewSummaryType,
  Restaurant,
  ThingToDo,
  TransportOption,
  TripDetails,
  TripDetailsInput,
  TripDetailsResponse,
} from "@/lib/types";
import { useT } from "@/lib/language";
import { track } from "@/lib/analytics";
import { destinationKey, useHostedTrips } from "@/lib/hostedTrips";
import { useGroupChat, type ChatParticipant } from "@/lib/chats";
import { recordRecentTrip } from "@/lib/recents";

const THEME_EMOJI: { keywords: string[]; emoji: string }[] = [
  { keywords: ["beach", "coast", "ocean", "sea", "island"], emoji: "🏖️" },
  { keywords: ["mountain", "hike", "trek", "summit", "peak"], emoji: "⛰️" },
  { keywords: ["food", "culinary", "taste", "eat", "market"], emoji: "🍜" },
  { keywords: ["history", "museum", "heritage", "ancient"], emoji: "🏛️" },
  { keywords: ["night", "party", "bar", "club"], emoji: "🌃" },
  { keywords: ["nature", "forest", "wild", "park"], emoji: "🌿" },
  { keywords: ["art", "gallery", "craft"], emoji: "🎨" },
  { keywords: ["relax", "spa", "wellness", "chill"], emoji: "🧘" },
  { keywords: ["city", "urban", "explore"], emoji: "🏙️" },
  { keywords: ["snow", "ski", "winter"], emoji: "⛷️" },
  { keywords: ["adventure", "explore", "discover"], emoji: "🌍" },
];

function emojiForTheme(theme: string): string {
  const lower = theme.toLowerCase();
  for (const { keywords, emoji } of THEME_EMOJI) {
    if (keywords.some((k) => lower.includes(k))) return emoji;
  }
  return "✨";
}

export function TripPlanner({ input }: { input: TripDetailsInput }) {
  const { t } = useT();
  const [details, setDetails] = useState<TripDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [activeSection, setActiveSection] = useState("overview");
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["overview"]),
  );
  const [loadingItinerary, setLoadingItinerary] = useState(true);
  const [loadingGroupTrips, setLoadingGroupTrips] = useState(true);
  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openSectionAndScroll = (id: string) => {
    setOpenSections((prev) => new Set(prev).add(id));
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const [joinTarget, setJoinTarget] = useState<GroupTrip | null>(null);
  const [showThings, setShowThings] = useState(false);
  const [showRestaurants, setShowRestaurants] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const destKey = destinationKey(input.name, input.country);
  const { hosted, addHosted, removeHosted, updateRequest } = useHostedTrips(destKey);
  const [requestsTarget, setRequestsTarget] = useState<{
    tripId: string;
    hostName: string;
    requests: JoinRequest[];
  } | null>(null);

  useEffect(() => {
    if (!details) return;
    const ids = ["overview", "flights", "hotels", "itinerary", "events", "travelers", "transport", "reviews", "tips"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [details]);

  useEffect(() => {
    let cancelled = false;
    track("trip_plan_viewed", {
      destination: input.name,
      country: input.country,
      origin: input.origin,
      travelers: input.travelers,
      budget: input.budget,
      currency: input.currency,
    });
    recordRecentTrip({
      name: input.name,
      country: input.country,
      origin: input.origin,
      startDate: input.startDate,
      endDate: input.endDate,
      budget: input.budget,
      currency: input.currency,
      travelers: input.travelers,
      interests: input.interests.join(","),
      constraints: input.constraints,
      vibe: input.vibe,
    });
    const startedAt = Date.now();
    (async () => {
      try {
        const res = await fetch("/api/trip-details", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        const ctype = res.headers.get("content-type") ?? "";
        // Plain JSON path (early errors: rate limit, validation, etc.)
        if (!ctype.includes("text/event-stream")) {
          const data: TripDetailsResponse = await res.json();
          if (cancelled) return;
          if (!data.ok) setError(data.error);
          else setDetails(data.details);
          return;
        }
        if (!res.body) {
          if (!cancelled) setError("Streaming not supported by this browser");
          return;
        }

        // SSE path. We accumulate sections as they arrive and call
        // setDetails the moment we have core (so the page renders);
        // itinerary and groupTrips fill in afterwards.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        type Base = Pick<
          TripDetails,
          | "reviews"
          | "events"
          | "budgetBreakdown"
          | "transportation"
          | "thingsToDo"
          | "restaurants"
        >;
        type Core = Pick<
          TripDetails,
          | "heroImage"
          | "overview"
          | "insiderTips"
          | "totalEstimate"
          | "flights"
          | "hotels"
        >;
        let baseData: Base | null = null;
        let coreData: Core | null = null;
        let firstRender = false;
        const tryRender = () => {
          if (firstRender || !baseData || !coreData) return;
          firstRender = true;
          setDetails({
            ...baseData,
            ...coreData,
            itinerary: [],
            groupTrips: [],
          });
          track("trip_plan_loaded", {
            destination: input.name,
            country: input.country,
            loadMs: Date.now() - startedAt,
          });
        };

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const ev of events) {
            if (!ev.trim()) continue;
            let eventName = "";
            let dataStr = "";
            for (const line of ev.split("\n")) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
            }
            if (!dataStr) continue;
            let payload: unknown;
            try {
              payload = JSON.parse(dataStr);
            } catch {
              continue;
            }
            if (eventName === "base") {
              baseData = payload as Base;
              tryRender();
            } else if (eventName === "core") {
              coreData = payload as Core;
              tryRender();
            } else if (eventName === "itinerary") {
              const { itinerary } = payload as { itinerary: TripDetails["itinerary"] };
              setDetails((prev) => (prev ? { ...prev, itinerary } : prev));
              setLoadingItinerary(false);
            } else if (eventName === "groupTrips") {
              const { groupTrips } = payload as {
                groupTrips: TripDetails["groupTrips"];
              };
              setDetails((prev) => (prev ? { ...prev, groupTrips } : prev));
              setLoadingGroupTrips(false);
            } else if (eventName === "error") {
              const { message } = payload as { message: string };
              if (!firstRender) setError(message);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="max-w-md text-center">
          <p className="mb-4 text-red-700 dark:text-red-300">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-slate-700 dark:text-slate-300">
          {t("trip.planning", { name: input.name })}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {t("trip.planningSub")}
        </p>
      </main>
    );
  }

  const activeDayData =
    details.itinerary.find((d) => d.day === activeDay) ?? details.itinerary[0];

  // Order in which sections appear on the page; conditional sections drop
  // out so "Continue →" walks across only the ones that actually render.
  const presentSections: string[] = ["overview", "flights", "hotels", "itinerary"];
  if (details.events.length > 0) presentSections.push("events");
  if (details.groupTrips.length > 0 || hosted.length > 0)
    presentSections.push("travelers");
  if (details.transportation.length > 0) presentSections.push("transport");
  presentSections.push("reviews");
  if (details.insiderTips.length > 0) presentSections.push("tips");

  const sectionLabel = (id: string): string => {
    if (id === "overview") return t("trip.overview");
    if (id === "flights") return t("trip.flights");
    if (id === "hotels") return t("trip.hotels");
    if (id === "transport") return t("transport.title");
    if (id === "itinerary") return t("trip.itinerary");
    if (id === "events") return t("trip.events");
    if (id === "reviews") return t("trip.reviews");
    if (id === "travelers") return t("trip.travelers");
    if (id === "tips") return t("trip.tips");
    return id;
  };
  const nextOf = (id: string): string | null => {
    const i = presentSections.indexOf(id);
    return i >= 0 && i < presentSections.length - 1
      ? presentSections[i + 1]
      : null;
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero */}
      <div className="relative h-[50vh] min-h-[360px] w-full overflow-hidden bg-slate-900">
        {details.heroImage && (
          <Image
            src={details.heroImage}
            alt={`${input.name}, ${input.country}`}
            fill
            className="object-cover"
            sizes="100vw"
            priority
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
        <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/25"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("trip.back")}
          </Link>
          <div className="mx-auto w-full max-w-5xl text-white">
            <div className="flex items-center gap-1.5 text-sm font-medium opacity-90">
              <MapPin className="h-4 w-4" />
              {input.country}
            </div>
            <h1 className="mt-1 text-5xl font-black leading-tight tracking-tight drop-shadow-xl sm:text-7xl">
              {input.name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-md">
                <Calendar className="h-4 w-4" />
                {input.startDate} → {input.endDate}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-md">
                <Wallet className="h-4 w-4" />
                {input.budget.toLocaleString()} {input.currency}
              </span>
              {input.travelers > 1 && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-md">
                  <Users className="h-4 w-4" />
                  {input.travelers} travelers
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky section nav */}
      <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
          <SectionTab
            active={activeSection === "overview"}
            label={t("trip.overview")}
            onClick={() => openSectionAndScroll("overview")}
          />
          <SectionTab
            active={activeSection === "flights"}
            label={t("trip.flights")}
            onClick={() => openSectionAndScroll("flights")}
          />
          <SectionTab
            active={activeSection === "hotels"}
            label={t("trip.hotels")}
            onClick={() => openSectionAndScroll("hotels")}
          />
          <SectionTab
            active={activeSection === "itinerary"}
            label={t("trip.itinerary")}
            onClick={() => openSectionAndScroll("itinerary")}
          />
          {details.events.length > 0 && (
            <SectionTab
              active={activeSection === "events"}
              label={`${t("trip.events")} (${details.events.length})`}
              onClick={() => openSectionAndScroll("events")}
            />
          )}
          {details.groupTrips.length > 0 && (
            <SectionTab
              active={activeSection === "travelers"}
              label={t("trip.travelers")}
              onClick={() => openSectionAndScroll("travelers")}
            />
          )}
          {details.transportation.length > 0 && (
            <SectionTab
              active={activeSection === "transport"}
              label={t("transport.title")}
              onClick={() => openSectionAndScroll("transport")}
            />
          )}
          <SectionTab
            active={activeSection === "reviews"}
            label={`${t("trip.reviews")} (${details.reviews.totalCount})`}
            onClick={() => openSectionAndScroll("reviews")}
          />
          {details.insiderTips.length > 0 && (
            <SectionTab
              active={activeSection === "tips"}
              label={t("trip.tips")}
              onClick={() => openSectionAndScroll("tips")}
            />
          )}
        </div>
      </nav>

      <div className="mx-auto w-full max-w-5xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
        {/* Overview + budget breakdown */}
        <section id="overview" className="scroll-mt-20 grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3">
            <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-slate-50">
              {t("trip.overview")}
            </h2>
            <p className="leading-relaxed text-slate-700 dark:text-slate-300">
              {details.overview}
            </p>
          </div>
          <div className="md:col-span-2">
            <BudgetBreakdownCard
              breakdown={details.budgetBreakdown}
              travelers={input.travelers}
            />
          </div>
        </section>

        {/* Flights */}
        <section id="flights" className="scroll-mt-20">
          <SectionHeader
            icon={<Plane className="h-5 w-5" />}
            title={t("trip.flights")}
            subtitle={`${t("trip.cheapestFirst")} · Prices are estimates — click "See live prices" to compare on momondo`}
            badge={`${details.flights.length} options`}
            open={openSections.has("flights")}
            onToggle={() => toggleSection("flights")}
          />
          {openSections.has("flights") && (
          <div className="space-y-3">
            {details.flights.map((f, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <div className="font-bold text-slate-900 dark:text-slate-50">
                      {f.airline}
                    </div>
                    {i === 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {t("trip.cheapest")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {t("trip.hoursTotal", { n: f.durationHours })} ·{" "}
                    {f.stops === 0
                      ? t("trip.nonstop")
                      : t(f.stops === 1 ? "trip.stopN" : "trip.stopsN", { n: f.stops })}
                  </div>
                  {f.notes && (
                    <div className="mt-1 text-xs italic text-slate-500">
                      {f.notes}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <div className="flex items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                      Estimate
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-slate-50">
                      ~{f.approxPrice.toLocaleString()}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        {f.currency}
                      </span>
                    </div>
                  </div>
                  <a
                    href={f.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      track("flight_book_clicked", {
                        airline: f.airline,
                        price: f.approxPrice,
                        currency: f.currency,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    See live prices
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
          )}
          {openSections.has("flights") && nextOf("flights") && (
            <NextSectionButton
              label={sectionLabel(nextOf("flights")!)}
              onClick={() => openSectionAndScroll(nextOf("flights")!)}
            />
          )}
        </section>

        {/* Hotels */}
        <section id="hotels" className="scroll-mt-20">
          <SectionHeader
            icon={<Hotel className="h-5 w-5" />}
            title={t("trip.hotels")}
            subtitle={`${t("trip.perNight")} · Prices are estimates — click "See live prices" to compare on Booking.com`}
            badge={`${details.hotels.length} stays`}
            open={openSections.has("hotels")}
            onToggle={() => toggleSection("hotels")}
          />
          {openSections.has("hotels") && (
          <div className="grid gap-4 sm:grid-cols-2">
            {details.hotels.map((h, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      <Hotel className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-slate-50">
                          {h.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm font-semibold">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {h.ratingOutOf5.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-sm text-slate-500">{h.area}</div>
                    </div>
                  </div>
                  {h.highlights.length > 0 && (
                    <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                      {h.highlights.slice(0, 3).map((hi, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="text-slate-400">•</span>
                          {hi}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                          Estimate
                        </span>
                        <div className="text-lg font-black text-slate-900 dark:text-slate-50">
                          ~{h.approxPricePerNight.toLocaleString()}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            {h.currency}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">{t("trip.perNight")}</div>
                    </div>
                    <a
                      href={h.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        track("hotel_book_clicked", {
                          hotelName: h.name,
                          pricePerNight: h.approxPricePerNight,
                          currency: h.currency,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      See live prices
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
          {openSections.has("hotels") && nextOf("hotels") && (
            <NextSectionButton
              label={sectionLabel(nextOf("hotels")!)}
              onClick={() => openSectionAndScroll(nextOf("hotels")!)}
            />
          )}
        </section>

        {/* Itinerary — mockup style with emoji day headers */}
        <section id="itinerary" className="scroll-mt-20">
          <SectionHeader
            icon={<Calendar className="h-5 w-5" />}
            title={t("trip.itinerary")}
            subtitle={
              loadingItinerary
                ? "Generating day-by-day plan…"
                : t("trip.daysTailored", { n: details.itinerary.length })
            }
            badge={loadingItinerary ? "loading…" : `${details.itinerary.length} days`}
            open={openSections.has("itinerary")}
            onToggle={() => toggleSection("itinerary")}
          />
          {openSections.has("itinerary") && loadingItinerary && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#00aa6c]" />
              Generating your day-by-day plan…
            </div>
          )}
          {openSections.has("itinerary") && !loadingItinerary && (
          <>

          {/* Day tabs */}
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {details.itinerary.map((d) => (
              <button
                key={d.day}
                onClick={() => setActiveDay(d.day)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${
                  activeDay === d.day
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                Day {d.day}
              </button>
            ))}
          </div>

          {activeDayData && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Day {activeDayData.day} · {activeDayData.date}
              </div>
              <h3 className="mb-5 flex items-center gap-2 text-2xl font-black text-slate-900 dark:text-slate-50">
                {activeDayData.theme}
                <span>{emojiForTheme(activeDayData.theme)}</span>
              </h3>
              <div className="space-y-5">
                {activeDayData.activities.map((a, i) => (
                  <div key={i} className="flex gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        a.timeOfDay === "morning"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : a.timeOfDay === "afternoon"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      }`}
                    >
                      {a.timeOfDay === "morning" && <Sunrise className="h-5 w-5" />}
                      {a.timeOfDay === "afternoon" && <Sun className="h-5 w-5" />}
                      {a.timeOfDay === "evening" && <Moon className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {a.timeOfDay === "morning"
                          ? t("trip.morning")
                          : a.timeOfDay === "afternoon"
                            ? t("trip.afternoon")
                            : t("trip.evening")}
                      </div>
                      <div className="font-bold text-slate-900 dark:text-slate-50">
                        {a.title}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {a.description}
                      </p>
                      {a.estimatedCost && (
                        <div className="mt-1 text-xs text-slate-500">
                          {t("trip.estCost")} {a.estimatedCost}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* See all things to do toggle */}
          {details.thingsToDo.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => {
                  setShowThings((v) => {
                    if (!v) track("things_to_do_expanded", { destination: input.name });
                    return !v;
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:border-slate-900 hover:bg-slate-50"
              >
                <Compass className="h-4 w-4" />
                {showThings
                  ? t("things.hide")
                  : t("things.seeAll", { n: details.thingsToDo.length, name: input.name })}
              </button>
              {showThings && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {details.thingsToDo.map((thing) => (
                    <ThingToDoCard key={thing.id} thing={thing} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Restaurants toggle */}
          {details.restaurants.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => {
                  setShowRestaurants((v) => {
                    if (!v) track("restaurants_expanded", { destination: input.name });
                    return !v;
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:border-slate-900 hover:bg-slate-50"
              >
                <Utensils className="h-4 w-4" />
                {showRestaurants
                  ? t("rest.hide")
                  : t("rest.seeAll", { n: details.restaurants.length, name: input.name })}
              </button>
              {showRestaurants && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {details.restaurants.map((r) => (
                    <RestaurantCard key={r.id} restaurant={r} />
                  ))}
                </div>
              )}
            </div>
          )}
          </>
          )}
          {openSections.has("itinerary") && nextOf("itinerary") && (
            <NextSectionButton
              label={sectionLabel(nextOf("itinerary")!)}
              onClick={() => openSectionAndScroll(nextOf("itinerary")!)}
            />
          )}
        </section>

        {/* Events during your trip */}
        {details.events.length > 0 && (
          <section id="events" className="scroll-mt-20">
            <SectionHeader
              icon={<Ticket className="h-5 w-5" />}
              title={t("trip.eventsTitle")}
              subtitle={t("trip.eventsSub", { n: details.events.length })}
              badge={`${details.events.length} events`}
              open={openSections.has("events")}
              onToggle={() => toggleSection("events")}
            />
            {openSections.has("events") && (
              <div className="grid gap-4 sm:grid-cols-2">
                {details.events.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}
            {openSections.has("events") && nextOf("events") && (
              <NextSectionButton
                label={sectionLabel(nextOf("events")!)}
                onClick={() => openSectionAndScroll(nextOf("events")!)}
              />
            )}
          </section>
        )}

        {/* Travelers heading there */}
        {(details.groupTrips.length > 0 || hosted.length > 0) && (
          <section id="travelers" className="scroll-mt-20">
            <SectionHeader
              icon={<Users className="h-5 w-5" />}
              title={t("trip.travelersTitle")}
              subtitle={t("trip.travelersSub")}
              badge={`${details.groupTrips.length + hosted.length} groups`}
              open={openSections.has("travelers")}
              onToggle={() => toggleSection("travelers")}
              actionRight={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHostModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#34e0a1] px-4 py-2 text-sm font-black text-slate-900 transition hover:bg-[#2ccb91]"
                >
                  <Plus className="h-4 w-4" />
                  {t("host.button")}
                </button>
              }
            />
            {openSections.has("travelers") && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {hosted.map((g) => (
                    <GroupTripCard
                      key={g.id}
                      group={g}
                      onJoin={() => undefined}
                      hostedByMe
                      onDelete={() => removeHosted(g.id)}
                      pendingRequests={g.requests.filter((r) => r.status === "pending").length}
                      onViewRequests={() =>
                        setRequestsTarget({
                          tripId: g.id,
                          hostName: g.hostName,
                          requests: g.requests,
                        })
                      }
                    />
                  ))}
                  {details.groupTrips.map((g) => (
                    <GroupTripCard key={g.id} group={g} onJoin={() => setJoinTarget(g)} />
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Group trips are demo listings. Real matchmaking + messaging coming soon.
                </p>
              </>
            )}
            {openSections.has("travelers") && nextOf("travelers") && (
              <NextSectionButton
                label={sectionLabel(nextOf("travelers")!)}
                onClick={() => openSectionAndScroll(nextOf("travelers")!)}
              />
            )}
          </section>
        )}

        {/* Transportation */}
        {details.transportation.length > 0 && (
          <section id="transport" className="scroll-mt-20">
            <SectionHeader
              icon={<Bus className="h-5 w-5" />}
              title={t("transport.title")}
              subtitle={t("transport.subtitle", { name: input.name })}
              badge={`${details.transportation.length} options`}
              open={openSections.has("transport")}
              onToggle={() => toggleSection("transport")}
            />
            {openSections.has("transport") && (
              <div className="grid gap-4 sm:grid-cols-2">
                {details.transportation.map((opt) => (
                  <TransportCard key={opt.id} option={opt} />
                ))}
              </div>
            )}
            {openSections.has("transport") && nextOf("transport") && (
              <NextSectionButton
                label={sectionLabel(nextOf("transport")!)}
                onClick={() => openSectionAndScroll(nextOf("transport")!)}
              />
            )}
          </section>
        )}

        {/* Reviews */}
        <section id="reviews" className="scroll-mt-20">
          <SectionHeader
            icon={<MessageSquare className="h-5 w-5" />}
            title={t("trip.whatTravelersSay")}
            subtitle={t("trip.reviewsCount", { n: details.reviews.totalCount.toLocaleString() })}
            badge={`${details.reviews.totalCount.toLocaleString()} reviews`}
            open={openSections.has("reviews")}
            onToggle={() => toggleSection("reviews")}
          />
          {openSections.has("reviews") && (
            <ReviewsSummary summary={details.reviews} />
          )}
          {openSections.has("reviews") && nextOf("reviews") && (
            <NextSectionButton
              label={sectionLabel(nextOf("reviews")!)}
              onClick={() => openSectionAndScroll(nextOf("reviews")!)}
            />
          )}
        </section>

        {/* Insider tips */}
        {details.insiderTips.length > 0 && (
          <section id="tips" className="scroll-mt-20">
            <SectionHeader
              icon={<Lightbulb className="h-5 w-5" />}
              title={t("trip.insiderTips")}
              subtitle={t("trip.guideMiss")}
              badge={`${details.insiderTips.length} tips`}
              open={openSections.has("tips")}
              onToggle={() => toggleSection("tips")}
            />
            {openSections.has("tips") && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {details.insiderTips.map((tip, i) => (
                  <li
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {joinTarget && (
        <JoinModal group={joinTarget} onClose={() => setJoinTarget(null)} />
      )}

      {requestsTarget && (
        <RequestsModal
          trip={requestsTarget}
          onClose={() => setRequestsTarget(null)}
          onAccept={(rid) => {
            updateRequest(requestsTarget.tripId, rid, "accepted");
            setRequestsTarget((prev) =>
              prev
                ? {
                    ...prev,
                    requests: prev.requests.map((r) =>
                      r.id === rid ? { ...r, status: "accepted" } : r,
                    ),
                  }
                : prev,
            );
          }}
          onDeny={(rid) => {
            updateRequest(requestsTarget.tripId, rid, "denied");
            setRequestsTarget((prev) =>
              prev
                ? {
                    ...prev,
                    requests: prev.requests.map((r) =>
                      r.id === rid ? { ...r, status: "denied" } : r,
                    ),
                  }
                : prev,
            );
          }}
        />
      )}

      {showHostModal && (
        <HostTripModal
          defaultStart={input.startDate}
          defaultEnd={input.endDate}
          onClose={() => setShowHostModal(false)}
          onSubmit={(trip) => {
            addHosted(trip);
            track("group_trip_hosted", {
              destination: input.name,
              capacity: trip.capacity,
              focusCount: trip.focus.length,
            });
          }}
        />
      )}
    </main>
  );
}

const BUDGET_STYLE: Record<
  BudgetCategory,
  { icon: React.ComponentType<{ className?: string }>; tkey: "budget.flights" | "budget.lodging" | "budget.food" | "budget.activities" | "budget.transport" | "budget.misc"; color: string }
> = {
  flights: { icon: Plane, tkey: "budget.flights", color: "bg-indigo-500" },
  lodging: { icon: Hotel, tkey: "budget.lodging", color: "bg-rose-500" },
  food: { icon: Utensils, tkey: "budget.food", color: "bg-amber-500" },
  activities: { icon: Ticket, tkey: "budget.activities", color: "bg-emerald-500" },
  transport: { icon: Bus, tkey: "budget.transport", color: "bg-sky-500" },
  misc: { icon: MoreHorizontal, tkey: "budget.misc", color: "bg-slate-500" },
};

function BudgetBreakdownCard({
  breakdown,
  travelers,
}: {
  breakdown: BudgetBreakdown;
  travelers: number;
}) {
  const { t } = useT();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#34e0a1] text-slate-900">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="text-sm font-black text-slate-900">
            {t("budget.title")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black leading-none text-slate-900">
            {breakdown.total.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {breakdown.currency} {t("budget.total").toLowerCase()}
          </div>
        </div>
      </div>

      {/* Stacked segmented bar */}
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {breakdown.items.map((item) => {
          const style = BUDGET_STYLE[item.category];
          const pct = (item.amount / breakdown.total) * 100;
          return (
            <div
              key={item.category}
              className={style.color}
              style={{ width: `${pct}%` }}
              title={`${t(style.tkey)}: ${item.amount.toLocaleString()} ${breakdown.currency}`}
            />
          );
        })}
      </div>

      {/* Compact 2-column legend */}
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {breakdown.items.map((item) => {
          const style = BUDGET_STYLE[item.category];
          const Icon = style.icon;
          const pct = Math.round((item.amount / breakdown.total) * 100);
          return (
            <li
              key={item.category}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${style.color} text-white`}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate font-semibold text-slate-900">
                    {t(style.tkey)}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {pct}%
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-700">
                  {item.amount.toLocaleString()}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {travelers > 1 && (
        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {t("budget.perPerson", {
            amount: breakdown.perPerson.toLocaleString(),
            currency: breakdown.currency,
            n: travelers,
          })}
        </div>
      )}
    </div>
  );
}

const THING_CATEGORY_STYLE: Record<
  ThingToDo["category"],
  { bg: string; text: string }
> = {
  sights: { bg: "bg-sky-100", text: "text-sky-700" },
  food: { bg: "bg-amber-100", text: "text-amber-700" },
  nature: { bg: "bg-emerald-100", text: "text-emerald-700" },
  culture: { bg: "bg-violet-100", text: "text-violet-700" },
  adventure: { bg: "bg-rose-100", text: "text-rose-700" },
  shopping: { bg: "bg-pink-100", text: "text-pink-700" },
  nightlife: { bg: "bg-indigo-100", text: "text-indigo-700" },
  wellness: { bg: "bg-teal-100", text: "text-teal-700" },
};

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const { t } = useT();
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {restaurant.imageUrl && (
        <div className="relative aspect-[5/3] w-full bg-slate-100">
          <Image
            src={restaurant.imageUrl}
            alt={restaurant.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-slate-900 shadow">
              {restaurant.cuisine}
            </span>
            <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-black text-white shadow">
              {restaurant.priceLevel}
            </span>
          </div>
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold leading-tight text-slate-900">
            {restaurant.name}
          </h3>
          <span className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-slate-900">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {restaurant.rating.toFixed(1)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-700">
          {restaurant.description}
        </p>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <div className="font-bold uppercase tracking-wider text-slate-500">
            {t("rest.signatureDish")}
          </div>
          <div className="mt-0.5 text-slate-800">{restaurant.signatureDish}</div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1 text-xs text-slate-600">
            <MapPin className="h-3.5 w-3.5" />
            {restaurant.neighborhood}
          </span>
          {restaurant.reservationUrl && (
            <a
              href={restaurant.reservationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-[#34e0a1] px-3 py-1.5 text-xs font-black text-slate-900 transition hover:bg-[#2ccb91]"
            >
              {t("rest.reserve")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ThingToDoCard({ thing }: { thing: ThingToDo }) {
  const { t } = useT();
  const style = THING_CATEGORY_STYLE[thing.category];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {thing.imageUrl && (
        <div className="relative aspect-[5/3] w-full bg-slate-100">
          <Image
            src={thing.imageUrl}
            alt={thing.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
          <span
            className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}
          >
            {thing.category}
          </span>
        </div>
      )}
      <div className="space-y-2 p-4">
        <h3 className="text-base font-bold leading-tight text-slate-900">
          {thing.name}
        </h3>
        <p className="text-sm leading-relaxed text-slate-700">{thing.description}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {thing.duration}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {thing.location}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <span className="text-sm font-bold text-slate-900">{thing.price}</span>
          {thing.infoUrl && (
            <a
              href={thing.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#00aa6c] hover:underline"
            >
              {t("things.moreInfo")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const TRANSPORT_STYLE: Record<
  TransportOption["mode"],
  { icon: React.ComponentType<{ className?: string }>; bg: string; text: string }
> = {
  transit: { icon: Bus, bg: "bg-indigo-100", text: "text-indigo-700" },
  train: { icon: Train, bg: "bg-emerald-100", text: "text-emerald-700" },
  bike: { icon: Bike, bg: "bg-amber-100", text: "text-amber-700" },
  rideshare: { icon: CarTaxiFront, bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
  taxi: { icon: CarTaxiFront, bg: "bg-yellow-100", text: "text-yellow-700" },
  car_rental: { icon: Car, bg: "bg-rose-100", text: "text-rose-700" },
  walk: { icon: Footprints, bg: "bg-sky-100", text: "text-sky-700" },
};

function TransportCard({ option }: { option: TransportOption }) {
  const { t } = useT();
  const style = TRANSPORT_STYLE[option.mode];
  const Icon = style.icon;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold leading-tight text-slate-900">{option.title}</h3>
            <div className="mt-0.5 text-xs text-slate-500">{option.coverage}</div>
          </div>
        </div>
        {option.recommended && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e0f7ec] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#004f32]">
            <CheckCircle2 className="h-3 w-3" />
            {t("transport.recommended")}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-slate-700">{option.description}</p>

      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {t("transport.howTo")}
        </div>
        <ol className="space-y-1.5 text-sm text-slate-700">
          {option.howTo.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text} text-[11px] font-bold`}>
                {i + 1}
              </span>
              <span className="flex-1">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t("transport.price")}
          </div>
          <div className="text-sm font-bold text-slate-900">{option.price}</div>
        </div>
        {option.bookingUrl && (
          <a
            href={option.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              track("transport_book_clicked", {
                mode: option.mode,
                title: option.title,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            {t("transport.book")}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

const EVENT_STYLE: Record<
  LocalEvent["category"],
  { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; tkey: "event.music" | "event.festival" | "event.sports" | "event.art" | "event.food" | "event.theater" | "event.cultural" }
> = {
  music: { icon: Music, bg: "bg-indigo-100", text: "text-indigo-700", tkey: "event.music" },
  festival: { icon: PartyPopper, bg: "bg-fuchsia-100", text: "text-fuchsia-700", tkey: "event.festival" },
  sports: { icon: Trophy, bg: "bg-emerald-100", text: "text-emerald-700", tkey: "event.sports" },
  art: { icon: Palette, bg: "bg-rose-100", text: "text-rose-700", tkey: "event.art" },
  food: { icon: Utensils, bg: "bg-amber-100", text: "text-amber-700", tkey: "event.food" },
  theater: { icon: Drama, bg: "bg-violet-100", text: "text-violet-700", tkey: "event.theater" },
  cultural: { icon: Landmark, bg: "bg-sky-100", text: "text-sky-700", tkey: "event.cultural" },
};

const TRIP_TYPE_TKEY: Record<string, "review.solo" | "review.couple" | "review.friends" | "review.family" | "review.business"> = {
  "Solo traveler": "review.solo",
  "Couple": "review.couple",
  "Friends trip": "review.friends",
  "Family with kids": "review.family",
  "Business trip": "review.business",
};

function EventCard({ event }: { event: LocalEvent }) {
  const { t } = useT();
  const style = EVENT_STYLE[event.category];
  const Icon = style.icon;
  const sameDay = event.startDate === event.endDate;
  const dateLabel = sameDay ? event.startDate : `${event.startDate} → ${event.endDate}`;

  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold leading-snug text-slate-900">{event.title}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}
          >
            {t(style.tkey)}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {dateLabel}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {event.venue}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-700">{event.description}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-slate-900">{event.price}</span>
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track("event_tickets_clicked", {
                  title: event.title,
                  category: event.category,
                })
              }
              className="inline-flex items-center gap-1 rounded-full bg-[#34e0a1] px-3 py-1.5 text-xs font-black text-slate-900 transition hover:bg-[#2ccb91]"
            >
              {t("trip.getTickets")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewsSummary({ summary }: { summary: ReviewSummaryType }) {
  const { t } = useT();
  const [filter, setFilter] = useState<string>("all");
  const filtered =
    filter === "all"
      ? summary.reviews
      : summary.reviews.filter((r) => r.tripType === filter);
  const tripTypes = Array.from(new Set(summary.reviews.map((r) => r.tripType)));
  const max = Math.max(...summary.breakdown.map((b) => b.count));
  const labelFor = (type: string) => (TRIP_TYPE_TKEY[type] ? t(TRIP_TYPE_TKEY[type]) : type);

  return (
    <div className="space-y-5">
      {/* Top summary row */}
      <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-[auto_1fr]">
        <div className="text-center">
          <div className="text-5xl font-black text-slate-900">
            {summary.averageRating.toFixed(1)}
          </div>
          <div className="mt-1 flex justify-center">
            <StarRow rating={summary.averageRating} />
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {t("trip.reviewsCount", { n: summary.totalCount.toLocaleString() })}
          </div>
        </div>
        <div className="space-y-1.5">
          {summary.breakdown.map((b) => (
            <div key={b.stars} className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0 text-slate-700">{b.stars} {t("trip.stars")}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-[#34e0a1]"
                  style={{ width: `${max === 0 ? 0 : (b.count / max) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs text-slate-500">
                {b.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          key="all"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
            filter === "all"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:border-slate-900"
          }`}
        >
          {t("review.allFilter")}
        </button>
        {tripTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              filter === type
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:border-slate-900"
            }`}
          >
            {labelFor(type)}
          </button>
        ))}
      </div>

      {/* Review cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const { t } = useT();
  const initials = review.authorName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const timeLabel =
    review.daysAgo < 7
      ? t("time.daysAgo", { n: review.daysAgo })
      : review.daysAgo < 30
        ? t("time.weeksAgo", { n: Math.round(review.daysAgo / 7) })
        : t("time.monthsAgo", { n: Math.round(review.daysAgo / 30) });
  const tripTypeLabel = TRIP_TYPE_TKEY[review.tripType]
    ? t(TRIP_TYPE_TKEY[review.tripType])
    : review.tripType;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
          {initials}
        </div>
        <div className="flex-1">
          <div className="font-bold text-slate-900">{review.authorName}</div>
          <div className="text-xs text-slate-500">
            {tripTypeLabel} · {timeLabel}
          </div>
        </div>
      </div>
      <StarRow rating={review.rating} />
      <h4 className="mt-2 font-bold text-slate-900">{review.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{review.body}</p>
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)));
        return (
          <span
            key={i}
            className="relative inline-block h-4 w-4"
            aria-hidden
          >
            <Star className="absolute inset-0 h-4 w-4 stroke-[#34e0a1] text-slate-200" />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className="h-4 w-4 fill-[#34e0a1] text-[#34e0a1]" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function GroupTripCard({
  group,
  onJoin,
  hostedByMe,
  onDelete,
  pendingRequests,
  onViewRequests,
}: {
  group: GroupTrip;
  onJoin: () => void;
  hostedByMe?: boolean;
  onDelete?: () => void;
  pendingRequests?: number;
  onViewRequests?: () => void;
}) {
  const { t } = useT();
  const spotsLeft = group.capacity - group.travelersCount;
  const initials = group.hostName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const color = avatarColor(group.hostName);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-black text-white ${color}`}
          >
            {initials}
          </div>
          <div>
            <div className="font-bold text-slate-900">{group.hostName}</div>
            <div className="text-xs text-slate-500">
              {group.hostVibe} · from {group.hostOrigin}
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            spotsLeft > 0
              ? "bg-[#e0f7ec] text-[#004f32]"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {spotsLeft > 0 ? t("trip.spotsLeft", { n: spotsLeft }) : t("trip.full")}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {group.startDate} → {group.endDate}
        </span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {group.travelersCount}/{group.capacity} {t("trip.travelers").toLowerCase()}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-slate-700">{group.blurb}</p>

      <div className="flex flex-wrap gap-1.5">
        {group.focus.map((f) => (
          <span
            key={f}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
          >
            {f}
          </span>
        ))}
      </div>

      {hostedByMe ? (
        <div className="mt-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-black text-white">
              ✓ {t("host.hostedByYou")}
            </span>
            {onDelete && (
              <button
                onClick={onDelete}
                aria-label={t("host.delete")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:border-rose-500 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {onViewRequests && (
            <button
              onClick={onViewRequests}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#34e0a1] bg-[#e0f7ec] px-4 py-2 text-sm font-bold text-[#004f32] hover:bg-[#34e0a1]/30"
            >
              <Users className="h-4 w-4" />
              {pendingRequests && pendingRequests > 0
                ? `${t("host.viewRequests", { n: pendingRequests })}`
                : t("host.requestsTitle")}
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onJoin}
          disabled={spotsLeft <= 0}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#34e0a1] px-4 py-2.5 text-sm font-black text-slate-900 transition hover:bg-[#2ccb91] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {t("trip.requestJoin")}
        </button>
      )}
    </div>
  );
}

function RequestsModal({
  trip,
  onClose,
  onAccept,
  onDeny,
}: {
  trip: { tripId: string; hostName: string; requests: JoinRequest[] };
  onClose: () => void;
  onAccept: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}) {
  const { t } = useT();
  const [chatOpen, setChatOpen] = useState(false);
  const pending = trip.requests.filter((r) => r.status === "pending").length;
  const accepted = trip.requests.filter((r) => r.status === "accepted").length;
  const activeRequests = trip.requests.filter((r) => r.status !== "denied");
  const participants: ChatParticipant[] = [
    { id: "host", name: trip.hostName, isHost: true },
    ...activeRequests.map((r) => ({ id: r.id, name: r.requesterName })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-[80vh] max-h-[600px] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {chatOpen ? (
          <GroupChatView
            tripId={trip.tripId}
            participants={participants}
            onBack={() => setChatOpen(false)}
          />
        ) : (
          <>
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-xl font-black text-slate-900">
                {t("host.requestsTitle")}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {t("host.requestsSubtitle", { pending, accepted })}
              </p>
              {activeRequests.length > 0 && (
                <button
                  onClick={() => setChatOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  {t("chat.openGroup")} ·{" "}
                  {t("chat.participants", { n: participants.length })}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {trip.requests.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  {t("host.requestsEmpty")}
                </p>
              ) : (
                <ul className="space-y-4">
                  {trip.requests.map((r) => {
                    const initials = r.requesterName
                      .split(/\s+/)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    const ago =
                      r.daysAgo === 0
                        ? t("time.justNow")
                        : t("time.daysAgo", { n: r.daysAgo });
                    return (
                      <li
                        key={r.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="truncate font-bold text-slate-900">
                                {r.requesterName}
                              </div>
                              <div className="shrink-0 text-xs text-slate-500">{ago}</div>
                            </div>
                            <div className="text-xs text-slate-500">
                              from {r.requesterOrigin}
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-slate-700">
                              {r.message}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {r.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => onAccept(r.id)}
                                    className="rounded-full bg-[#34e0a1] px-4 py-1.5 text-xs font-black text-slate-900 hover:bg-[#2ccb91]"
                                  >
                                    ✓ {t("host.accept")}
                                  </button>
                                  <button
                                    onClick={() => onDeny(r.id)}
                                    className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-900"
                                  >
                                    {t("host.decline")}
                                  </button>
                                </>
                              )}
                              {r.status === "accepted" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#e0f7ec] px-3 py-1 text-[11px] font-bold text-[#004f32]">
                                  ✓ {t("host.accepted")}
                                </span>
                              )}
                              {r.status === "denied" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
                                  {t("host.declined")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PARTICIPANT_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-teal-600",
];
function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PARTICIPANT_COLORS[h % PARTICIPANT_COLORS.length];
}
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function GroupChatView({
  tripId,
  participants,
  onBack,
}: {
  tripId: string;
  participants: ChatParticipant[];
  onBack: () => void;
}) {
  const { t } = useT();
  const { messages, sendAsHost } = useGroupChat(tripId, participants);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendAsHost(trimmed);
    setDraft("");
  };

  return (
    <>
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label={t("chat.back")}
            className="rounded-full p-1 text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900">{t("chat.groupTitle")}</div>
            <div className="text-xs text-slate-500">
              {t("chat.participants", { n: participants.length })}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {participants.map((p) => (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${
                p.isHost ? "bg-slate-900" : colorFor(p.id)
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[9px]">
                {initialsOf(p.name)}
              </span>
              {p.name}
              {p.isHost && <span className="text-[9px] opacity-70">HOST</span>}
            </span>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {t("chat.empty")}
          </div>
        ) : (
          messages.map((m) => {
            const fromHost = m.senderId === "host";
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${fromHost ? "justify-end" : "justify-start"}`}
              >
                {!fromHost && (
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${colorFor(m.senderId)}`}
                  >
                    {initialsOf(m.senderName)}
                  </div>
                )}
                <div className="max-w-[75%]">
                  {!fromHost && (
                    <div className="mb-0.5 text-[11px] font-bold text-slate-700">
                      {m.senderName}
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      fromHost
                        ? "bg-[#34e0a1] text-slate-900"
                        : "border border-slate-200 bg-white text-slate-900 shadow-sm"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="text-center text-[10px] text-slate-400">{t("chat.subtitle")}</div>
        <div className="mt-2 flex items-end gap-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("chat.placeholder")}
            className="flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm focus:border-[#00aa6c] focus:outline-none focus:ring-1 focus:ring-[#00aa6c]"
          />
          <button
            onClick={handleSend}
            disabled={draft.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#34e0a1] text-slate-900 hover:bg-[#2ccb91] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("chat.send")}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function HostTripModal({
  defaultStart,
  defaultEnd,
  onClose,
  onSubmit,
}: {
  defaultStart: string;
  defaultEnd: string;
  onClose: () => void;
  onSubmit: (trip: Omit<GroupTrip, "id">) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [vibe, setVibe] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [capacity, setCapacity] = useState(4);
  const [focusInput, setFocusInput] = useState("");
  const [blurb, setBlurb] = useState("");
  const [done, setDone] = useState(false);

  const blurbMin = 10;
  const blurbLen = blurb.trim().length;
  const valid =
    name.trim().length > 0 &&
    origin.trim().length > 0 &&
    vibe.trim().length > 0 &&
    blurbLen >= blurbMin &&
    capacity >= 1 &&
    capacity <= 10;

  const handleSubmit = () => {
    const focus = focusInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSubmit({
      hostName: name.trim(),
      hostOrigin: origin.trim(),
      hostVibe: vibe.trim(),
      startDate: start,
      endDate: end,
      travelersCount: 1,
      capacity,
      focus,
      blurb: blurb.trim(),
    });
    setDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {done ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e0f7ec] text-2xl">
              ✅
            </div>
            <h3 className="text-xl font-black text-slate-900">{t("host.published")}</h3>
            <p className="mt-1 text-sm text-slate-600">{t("host.publishedNote")}</p>
            <button
              onClick={onClose}
              className="mt-5 rounded-full bg-slate-900 px-6 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="max-h-[85vh] overflow-y-auto p-6">
            <h3 className="text-xl font-black text-slate-900">{t("host.title")}</h3>
            <p className="mt-1 text-sm text-slate-600">{t("host.subtitle")}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <HostField label={t("host.yourName")}>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("host.namePlaceholder")}
                  className={hostInputCls}
                />
              </HostField>
              <HostField label={t("host.yourOrigin")}>
                <input
                  required
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder={t("host.originPlaceholder")}
                  className={hostInputCls}
                />
              </HostField>
              <div className="sm:col-span-2">
                <HostField label={t("host.yourVibe")}>
                  <input
                    required
                    type="text"
                    value={vibe}
                    onChange={(e) => setVibe(e.target.value)}
                    placeholder={t("host.vibePlaceholder")}
                    className={hostInputCls}
                  />
                </HostField>
              </div>
              <div className="sm:col-span-2">
                <HostField label={`${t("form.checkInOut")}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className={hostInputCls}
                    />
                    <span className="text-slate-400">—</span>
                    <input
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className={hostInputCls}
                    />
                  </div>
                </HostField>
              </div>
              <div className="sm:col-span-2">
                <HostField label={t("host.capacity")}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCapacity((n) => Math.max(1, n - 1))}
                      disabled={capacity <= 1}
                      aria-label="Decrease"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[2.5rem] text-center text-xl font-black text-slate-900">
                      {capacity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCapacity((n) => Math.min(10, n + 1))}
                      disabled={capacity >= 10}
                      aria-label="Increase"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <span className="ml-1 text-xs text-slate-500">
                      {capacity === 1
                        ? "1 traveler"
                        : `1–${capacity} travelers`}
                    </span>
                  </div>
                </HostField>
              </div>
              <div className="sm:col-span-2">
                <HostField label={t("host.focusInterests")}>
                  <input
                    type="text"
                    value={focusInput}
                    onChange={(e) => setFocusInput(e.target.value)}
                    placeholder="food, hiking, photography"
                    className={hostInputCls}
                  />
                </HostField>
              </div>
              <div className="sm:col-span-2">
                <HostField label={t("host.blurb")}>
                  <textarea
                    rows={3}
                    value={blurb}
                    onChange={(e) => setBlurb(e.target.value)}
                    placeholder={t("host.blurbPlaceholder")}
                    className={hostInputCls}
                  />
                  <div
                    className={`mt-1 text-right text-[11px] ${
                      blurbLen >= blurbMin ? "text-slate-400" : "text-amber-700"
                    }`}
                  >
                    {blurbLen < blurbMin
                      ? `${blurbMin - blurbLen} more characters`
                      : `${blurbLen} characters`}
                  </div>
                </HostField>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                {t("host.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!valid}
                className="flex items-center gap-1.5 rounded-full bg-[#34e0a1] px-5 py-2 text-sm font-black text-slate-900 transition hover:bg-[#2ccb91] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("host.publish")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const hostInputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#00aa6c] focus:outline-none focus:ring-1 focus:ring-[#00aa6c]";

function HostField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function JoinModal({
  group,
  onClose,
}: {
  group: GroupTrip;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        {!sent ? (
          <>
            <h3 className="text-xl font-black text-slate-900">
              Request to join {group.hostName}&apos;s trip
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Send a short intro — {group.hostName} will see it and get back to you.
            </p>
            <textarea
              rows={4}
              placeholder="Hi! I'm headed to the same place. A little about me..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-[#00aa6c] focus:outline-none focus:ring-2 focus:ring-[#34e0a1]/30"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  track("join_request_sent", {
                    hostName: group.hostName,
                    messageLength: message.trim().length,
                  });
                  setSent(true);
                }}
                disabled={message.trim().length < 10}
                className="flex items-center gap-1.5 rounded-full bg-[#34e0a1] px-5 py-2 text-sm font-black text-slate-900 transition hover:bg-[#2ccb91] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send request
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Note: this is a demo. Real messaging launches when we release the
              social layer — you&apos;ll be notified to complete the request then.
            </p>
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e0f7ec] text-2xl">
              ✅
            </div>
            <h3 className="text-xl font-black text-slate-900">Request saved</h3>
            <p className="mt-1 text-sm text-slate-600">
              When the social layer launches, we&apos;ll connect you with{" "}
              {group.hostName}.
            </p>
            <button
              onClick={onClose}
              className="mt-5 rounded-full bg-slate-900 px-6 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-teal-600",
];
function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function SectionTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold transition ${
        active
          ? "border-[#34e0a1] text-slate-900"
          : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function NextSectionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
      >
        Continue to {label}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  badge,
  open,
  onToggle,
  actionRight,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  open?: boolean;
  onToggle?: () => void;
  actionRight?: React.ReactNode;
}) {
  // When onToggle is provided, the whole header becomes a clickable accordion
  // row; otherwise it falls back to the original static header layout.
  if (onToggle) {
    return (
      <div
        className={`flex items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-900 ${open ? "mb-5" : ""}`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5 dark:hover:bg-slate-800/60"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl dark:text-slate-50">
                {title}
              </h2>
              {badge && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {actionRight && open && (
          <div className="flex items-center pr-3 sm:pr-5">{actionRight}</div>
        )}
      </div>
    );
  }
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {icon}
          </div>
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}
