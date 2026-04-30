"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Minus,
  Plus,
  ArrowRight,
  Compass,
  Plane,
  Hotel,
  Bus,
  ClipboardCheck,
  Luggage,
} from "lucide-react";
import type { Destination, SuggestResponse, TravelInput } from "@/lib/types";
import { DestinationCard } from "./DestinationCard";
import { useT } from "@/lib/language";
import { track } from "@/lib/analytics";
import { VibeComboBox } from "./VibeComboBox";
import { Autocomplete } from "./Autocomplete";
import { ContinueSection } from "./ContinueSection";
import { searchPlaces } from "@/lib/photon";
import type { TKey } from "@/lib/translations";

type Mode = "discover" | "known";

const CLIMATES: { value: TravelInput["climate"]; tkey: TKey }[] = [
  { value: "any", tkey: "climate.any" },
  { value: "warm", tkey: "climate.warm" },
  { value: "tropical", tkey: "climate.tropical" },
  { value: "mild", tkey: "climate.mild" },
  { value: "cool", tkey: "climate.cool" },
  { value: "snowy", tkey: "climate.snowy" },
];

const todayPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function Advisor() {
  const router = useRouter();
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("discover");
  const [form, setForm] = useState<Omit<TravelInput, "budget" | "travelers">>({
    origin: "",
    startDate: todayPlus(30),
    endDate: todayPlus(37),
    currency: "USD",
    climate: "any",
    interests: [],
    vibe: "",
    constraints: "",
  });
  const [budgetInput, setBudgetInput] = useState<string>("2000");
  const [travelers, setTravelers] = useState<number>(1);
  const [vibeTags, setVibeTags] = useState<string[]>([]);
  const [knownTo, setKnownTo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [reasoning, setReasoning] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const applyInterests = (next: string[]) => {
    setForm((f) => ({
      ...f,
      interests: Array.from(new Set([...f.interests, ...next])),
    }));
  };

  const combinedVibe = () => {
    const typed = form.vibe.trim();
    const base = vibeTags.join(", ");
    if (!typed) return base;
    if (!base) return typed;
    return `${base}, ${typed}`;
  };

  const buildTripUrl = (name: string, country: string) => {
    const params = new URLSearchParams({
      name,
      country,
      origin: form.origin,
      start: form.startDate,
      end: form.endDate,
      budget: budgetInput,
      currency: form.currency,
      interests: form.interests.join(","),
      constraints: form.constraints,
      vibe: combinedVibe(),
      travelers: String(travelers),
    });
    return `/trip?${params.toString()}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const budget = parseInt(budgetInput.replace(/[^0-9]/g, ""), 10);
    if (!budget || budget < 1) {
      setError("Please enter a valid budget");
      return;
    }

    // "I know" mode — skip /api/suggest, go straight to trip plan
    if (mode === "known") {
      const trimmed = knownTo.trim();
      if (!trimmed) {
        setError("Enter your destination");
        return;
      }
      // Photon picks come back as "City, Region, Country" (or just "Country").
      // First comma-part is the place name, last is the country.
      const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
      const country = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const placeName = parts[0]
        .replace(/\s*\(.*?\)\s*/g, "")
        .replace(/\s+Airport\s*$/i, "")
        .trim() || parts[0];
      track("search_submitted", {
        mode: "known",
        origin: form.origin,
        destination: placeName,
        country,
        budget,
        currency: form.currency,
        travelers,
        nights: Math.max(
          1,
          Math.round(
            (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        ),
      });
      router.push(buildTripUrl(placeName, country));
      return;
    }

    setLoading(true);
    setError(null);
    setDestinations([]);
    setReasoning("");
    setSubmitted(true);

    const payload: TravelInput = { ...form, budget, travelers, vibe: combinedVibe() };
    track("search_submitted", {
      mode: "discover",
      origin: form.origin,
      budget,
      currency: form.currency,
      travelers,
      climate: form.climate,
      vibeTagsCount: vibeTags.length,
      hasConstraints: form.constraints.trim().length > 0,
    });
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Server may still respond with JSON for early errors (rate limit, validation).
      const ctype = res.headers.get("content-type") ?? "";
      if (!ctype.includes("text/event-stream")) {
        const data: SuggestResponse = await res.json();
        if (!data.ok) setError(data.error);
        else {
          setDestinations(data.destinations);
          setReasoning(data.reasoning);
        }
        setLoading(false);
        return;
      }

      // SSE stream — render destinations as they arrive.
      if (!res.body) {
        setError("Streaming not supported by this browser");
        setLoading(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // Hide the spinner as soon as the first card lands.
      let firstSeen = false;

      while (true) {
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
          if (eventName === "destination") {
            const { destination } = payload as { destination: Destination };
            setDestinations((prev) => [...prev, destination]);
            if (!firstSeen) {
              firstSeen = true;
              setLoading(false);
            }
          } else if (eventName === "done") {
            const { reasoning } = payload as { reasoning: string };
            setReasoning(reasoning);
          } else if (eventName === "error") {
            const { message } = payload as { message: string };
            setError(message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const tripQuery = (d: Destination) => buildTripUrl(d.name, d.country);

  return (
    <div>
      {/* Hero — soft gradient + four floating travel-themed decorations
          (plane, checklist, luggage, people) placed in each corner. No
          external images: all built from lucide-react icons so the page
          loads instantly and scales perfectly on any screen. */}
      <section className="relative mx-auto max-w-7xl overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-50 via-white to-amber-50"
        />
        {/* Decorative dotted travel-route arcs */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1200 220"
          preserveAspectRatio="none"
        >
          <path
            d="M 80 140 Q 300 60 500 130 T 900 110 T 1140 80"
            stroke="#67e8f9"
            strokeWidth="2"
            strokeDasharray="4 6"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M 60 60 Q 250 130 460 90 T 880 140 T 1140 130"
            stroke="#fcd34d"
            strokeWidth="2"
            strokeDasharray="4 6"
            fill="none"
            opacity="0.4"
          />
        </svg>

        {/* Top-left: checklist */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-2 top-3 hidden rotate-[-8deg] sm:left-6 sm:top-5 sm:block"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-600 shadow-sm sm:h-14 sm:w-14">
            <ClipboardCheck className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </div>

        {/* Top-right: plane (slight tilt, suggesting flight) */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-3 top-2 rotate-[20deg] sm:right-8 sm:top-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100/80 text-amber-600 shadow-sm sm:h-14 sm:w-14">
            <Plane className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </div>

        {/* Bottom-left: luggage / packed bag */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-2 left-3 rotate-[6deg] sm:bottom-3 sm:left-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100/80 text-indigo-600 shadow-sm sm:h-14 sm:w-14">
            <Luggage className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </div>

        {/* Bottom-right: connect with people */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-2 right-3 rotate-[-6deg] sm:bottom-3 sm:right-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100/80 text-rose-600 shadow-sm sm:h-14 sm:w-14">
            <Users className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </div>

        {/* Hero text — sits above the decorations */}
        <div className="relative z-10 px-4 pb-7 pt-10 text-center sm:px-6 sm:pb-10 sm:pt-14">
          <h1 className="mx-auto max-w-3xl text-2xl font-black leading-[1.15] tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            {mode === "known"
              ? t("hero.planTrip")
              : "Tell us your budget and vibe, we will handle the whole journey"}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1">
              <Plane className="h-3.5 w-3.5" /> Flights
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <Hotel className="h-3.5 w-3.5" /> Hotels
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Itinerary
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <Bus className="h-3.5 w-3.5" /> Transport
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Group trip match
            </span>
          </div>
        </div>
      </section>

      {/* Mode tabs */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("discover")}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${
              mode === "discover"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:border-slate-900"
            }`}
          >
            <Compass className="h-4 w-4" />
            {t("mode.helpPick")}
          </button>
          <button
            type="button"
            onClick={() => setMode("known")}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${
              mode === "known"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:border-slate-900"
            }`}
          >
            <MapPin className="h-4 w-4" />
            {t("mode.known")}
          </button>
        </div>
      </section>

      {/* Search card */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <form
          onSubmit={onSubmit}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
        >
          <div
            className={`grid grid-cols-1 gap-0 divide-y divide-slate-200 sm:divide-x sm:divide-y-0 ${
              mode === "known"
                ? "sm:grid-cols-[1fr_1fr_1.2fr_auto_1fr_auto]"
                : "sm:grid-cols-[1fr_1.4fr_auto_1fr_auto]"
            }`}
          >
            {/* From (origin) */}
            <label className="flex cursor-text items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <MapPin className="h-5 w-5 shrink-0 text-[#00aa6c]" />
              <div className="w-full min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {mode === "known" ? "From" : t("form.travelingFrom")}
                </div>
                <Autocomplete
                  required
                  value={form.origin}
                  onChange={(v) => setForm({ ...form, origin: v })}
                  loadOptions={searchPlaces}
                  placeholder={t("form.travelingFromPlaceholder")}
                  className="w-full border-0 bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>

            {/* To (only in known mode) */}
            {mode === "known" && (
              <label className="flex cursor-text items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <MapPin className="h-5 w-5 shrink-0 text-[#00aa6c]" />
                <div className="w-full min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    To
                  </div>
                  <Autocomplete
                    required
                    value={knownTo}
                    onChange={setKnownTo}
                    loadOptions={searchPlaces}
                    placeholder={t("form.destCityPlaceholder")}
                    className="w-full border-0 bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </label>
            )}

            {/* Dates */}
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <Calendar className="h-5 w-5 shrink-0 text-[#00aa6c]" />
              <div className="w-full min-w-0 space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t("form.checkInOut")}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    required
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full min-w-0 border-0 bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    required
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full min-w-0 border-0 bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Travelers */}
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <Users className="h-5 w-5 shrink-0 text-[#00aa6c]" />
              <div className="w-full min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t("form.travelers")}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTravelers((n) => Math.max(1, n - 1))}
                    aria-label="Fewer travelers"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={travelers <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[1.5rem] text-center text-base font-bold text-slate-900">
                    {travelers}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTravelers((n) => Math.min(12, n + 1))}
                    aria-label="More travelers"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={travelers >= 12}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Budget */}
            <label className="flex cursor-text items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <DollarSign className="h-5 w-5 shrink-0 text-[#00aa6c]" />
              <div className="w-full min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t("form.totalBudget")}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="2000"
                    value={budgetInput}
                    onChange={(e) =>
                      setBudgetInput(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    className="w-full min-w-0 border-0 bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                  />
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        currency: e.target.value as TravelInput["currency"],
                      })
                    }
                    className="shrink-0 border-0 bg-transparent text-sm font-bold text-slate-900 focus:outline-none"
                  >
                    <option>USD</option>
                    <option>EUR</option>
                    <option>GBP</option>
                    <option>CAD</option>
                    <option>AUD</option>
                  </select>
                </div>
              </div>
            </label>

            {/* Search button — desktop only (in grid row) */}
            <button
              type="submit"
              disabled={loading}
              className="hidden min-w-[140px] items-center justify-center gap-2 bg-[#34e0a1] px-6 py-4 text-base font-black text-slate-900 transition hover:bg-[#2ccb91] disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === "known" ? (
                <>
                  {t("form.planTrip")}
                  <ArrowRight className="h-5 w-5" />
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  {t("form.search")}
                </>
              )}
            </button>
          </div>

          {/* Climate + Vibe combobox — only relevant when discovering. In
              "known" mode the user has already chosen their destination, so
              filtering by climate/vibe is moot. */}
          {mode === "discover" && (
            <div className="grid gap-4 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-[240px_1fr]">
              <div>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                  {t("form.climate")}
                </div>
                <select
                  value={form.climate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      climate: e.target.value as TravelInput["climate"],
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-[#00aa6c] focus:outline-none focus:ring-1 focus:ring-[#00aa6c]"
                >
                  {CLIMATES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {t(c.tkey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                  {t("form.quickVibe")}
                </div>
                <VibeComboBox
                  values={vibeTags}
                  onChange={setVibeTags}
                  onApplyInterests={applyInterests}
                />
              </div>
            </div>
          )}

          {/* Constraints row */}
          <div className="border-t border-slate-200 p-4">
            <Field label={t("form.constraintsOptional")}>
              <textarea
                rows={2}
                placeholder={t("form.constraintsPlaceholder")}
                value={form.constraints}
                onChange={(e) => setForm({ ...form, constraints: e.target.value })}
                className={inputCls}
                />
              </Field>
            </div>

          {/* Mobile-only search button — appears after climate/vibe + constraints */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 bg-[#34e0a1] px-6 py-4 text-base font-black text-slate-900 transition hover:bg-[#2ccb91] disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : mode === "known" ? (
              <>
                {t("form.planTrip")}
                <ArrowRight className="h-5 w-5" />
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                {t("form.search")}
              </>
            )}
          </button>
        </form>
      </section>

      {/* Content below search */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        {error && (
          <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#00aa6c]" />
            <span>{t("loading.searching")}</span>
          </div>
        )}

        {/* Search results — show first so the user sees the new stuff before recents. */}
        {destinations.length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="text-3xl font-black tracking-tight text-slate-900">
                {t("results.title")}
              </h2>
              <p className="text-sm text-slate-600">
                {t("results.count", { n: destinations.length })}
              </p>
            </div>
            {reasoning && (
              <div className="mb-6 rounded-xl bg-[#e0f7ec] p-4 text-sm text-slate-800">
                <div className="mb-1 text-xs font-black uppercase tracking-wider text-[#004f32]">
                  {t("results.howWePicked")}
                </div>
                {reasoning}
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {destinations.map((d) => (
                <DestinationCard
                  key={`${d.name}-${d.country}`}
                  destination={d}
                  tripHref={tripQuery(d)}
                />
              ))}
            </div>
          </div>
        )}

        <ContinueSection />

        {!submitted && !loading && destinations.length === 0 && (
          <section>
            <h2 className="mb-3 text-3xl font-black tracking-tight text-slate-900">
              The whole trip, not just the destination
            </h2>
            <p className="mb-8 max-w-3xl text-slate-600">
              Pick a vibe above to get started, or see what&apos;s built in below.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Feature
                title="Destinations that fit you"
                body="Tell us your dates, budget, climate, vibe, and any quirky constraint (cat, wifi, motion-sick partner, want to feel small). We rank for those, not against them."
              />
              <Feature
                title="Everything to book"
                body="Flights sorted cheapest-first, hotels in your budget with booking links, local transport (metro cards, rentals), and a clear budget breakdown."
              />
              <Feature
                title="Everything to do"
                body="Day-by-day itinerary, top things to do, restaurants with signature dishes, and events happening during your stay."
              />
              <Feature
                title="Travel with others"
                body="Save destinations to favorites, host your own group trip, or find travelers already headed your way."
              />
              <Feature
                title="Real traveler reviews"
                body="See what solo travelers, couples, families, and friends say — filter by trip type to find voices like yours."
              />
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#00aa6c] focus:outline-none focus:ring-1 focus:ring-[#00aa6c]";

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="mb-2 text-lg font-black text-slate-900">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}
