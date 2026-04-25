"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Heart, MapPin, Plane, Hotel, Trash2 } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/language";

export function FavoritesList() {
  const { items, count, removeFavorite } = useFavorites();
  const { t } = useT();
  const formatAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t("time.justNow");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("time.minutesAgo", { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("time.hoursAgo", { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t("time.daysAgo", { n: days });
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return t("time.weeksAgo", { n: weeks });
    const months = Math.floor(days / 30);
    return t("time.monthsAgo", { n: months });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            {t("fav.title")}
          </h1>
          <p className="mt-2 text-slate-600">
            {count === 0
              ? t("fav.empty")
              : count === 1
                ? t("fav.countOne")
                : t("fav.countMany", { n: count })}
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:border-slate-900"
        >
          {t("fav.findMore")}
        </Link>
      </header>

      {count === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
            <Heart className="h-6 w-6 text-rose-500" />
          </div>
          <p className="text-slate-600">{t("fav.empty")}</p>
          <Link
            href="/"
            className="mt-2 rounded-full bg-[#34e0a1] px-6 py-2.5 text-sm font-black text-slate-900 hover:bg-[#2ccb91]"
          >
            {t("fav.startExploring")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const d = item.destination;
            const img = d.images[0];
            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] w-full bg-slate-100">
                  {img ? (
                    <Image
                      src={img.url}
                      alt={img.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      No image
                    </div>
                  )}
                  <button
                    onClick={() => removeFavorite(item.id)}
                    aria-label="Remove from favorites"
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:scale-110"
                  >
                    <Trash2 className="h-4 w-4 text-slate-700" />
                  </button>
                  <div className="absolute right-3 bottom-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                    {d.matchScore}% match
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {d.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
                      <MapPin className="h-3.5 w-3.5" />
                      {d.country}
                    </div>
                  </div>
                  <p className="text-sm italic text-slate-600">{d.vibe}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-700">
                    <span className="flex items-center gap-1">
                      <Plane className="h-3.5 w-3.5 text-[#00aa6c]" />$
                      {d.flightEstimate.amount.toLocaleString()}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-1">
                      <Hotel className="h-3.5 w-3.5 text-[#00aa6c]" />$
                      {d.hotelNightEstimate.amount.toLocaleString()}/night
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {t("fav.saved")} {formatAgo(item.savedAt)}
                  </div>
                  <Link
                    href={item.tripHref}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#34e0a1] px-4 py-2.5 text-sm font-black text-slate-900 transition hover:bg-[#2ccb91]"
                  >
                    {t("fav.viewPlan")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

