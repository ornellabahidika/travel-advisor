"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Heart,
  MapPin,
  Plane,
  Hotel,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import type { Destination } from "@/lib/types";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/language";
import { track } from "@/lib/analytics";

export function DestinationCard({
  destination,
  tripHref,
}: {
  destination: Destination;
  tripHref: string;
}) {
  const { t } = useT();
  const [imgIdx, setImgIdx] = useState(0);
  const [imgFailed, setImgFailed] = useState<Set<number>>(new Set());
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(destination);
  const validImages = destination.images.filter((_, i) => !imgFailed.has(i));
  const currentImage = validImages[imgIdx % Math.max(validImages.length, 1)];

  // 0..5 bubble rating (match/20 rounded to half)
  const bubbleValue = Math.round((destination.matchScore / 20) * 2) / 2;

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg">
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        {currentImage ? (
          <Image
            key={currentImage.url}
            src={currentImage.url}
            alt={currentImage.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
            onError={() =>
              setImgFailed((prev) =>
                new Set(prev).add(imgIdx % destination.images.length),
              )
            }
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            No image
          </div>
        )}

        {/* Heart save */}
        <button
          onClick={() => {
            toggleFavorite(destination, tripHref);
            track("favorite_toggled", {
              destination: destination.name,
              country: destination.country,
              action: saved ? "remove" : "add",
              matchScore: destination.matchScore,
            });
          }}
          aria-label={saved ? "Remove from favorites" : "Save to favorites"}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:scale-110"
        >
          <Heart
            className={`h-5 w-5 ${saved ? "fill-rose-500 text-rose-500" : "text-slate-700"}`}
          />
        </button>

        {/* Carousel dots */}
        {validImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
            {validImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                aria-label={`Image ${i + 1}`}
                className={`h-1.5 w-5 rounded-full transition ${
                  i === imgIdx % validImages.length ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3 p-5">
        <div>
          <Link href={tripHref} className="block">
            <h3 className="text-xl font-black leading-tight text-slate-900 hover:underline">
              {destination.name}
            </h3>
          </Link>
          <div className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
            <MapPin className="h-3.5 w-3.5" />
            {destination.country}
          </div>
        </div>

        {/* Rating bubbles */}
        <div className="flex items-center gap-2">
          <RatingBubbles value={bubbleValue} />
          <span className="text-sm text-slate-700">
            {t("card.match", { n: destination.matchScore })}
          </span>
        </div>

        {/* Vibe */}
        <p className="text-sm italic text-slate-600">{destination.vibe}</p>

        {/* Why it matches */}
        <p className="line-clamp-3 text-sm text-slate-700">
          {destination.whyItMatches}
        </p>

        {/* Flight + Hotel row */}
        <div className="flex items-center gap-3 text-xs text-slate-700">
          <span className="flex items-center gap-1">
            <Plane className="h-3.5 w-3.5 text-[#00aa6c]" />
            {destination.flightEstimate.airline} · $
            {destination.flightEstimate.amount.toLocaleString()}
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1">
            <Hotel className="h-3.5 w-3.5 text-[#00aa6c]" />
            ${destination.hotelNightEstimate.amount.toLocaleString()}/night
          </span>
        </div>

        {/* Counter suggestion */}
        {destination.counterSuggestion && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            <div className="flex items-center gap-1 font-bold text-amber-800">
              <AlertCircle className="h-3.5 w-3.5" />
              {t("card.tryInstead")} {destination.counterSuggestion.name}
            </div>
            <p className="mt-0.5 text-amber-900">
              {destination.counterSuggestion.reason}
            </p>
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-3">
          <div>
            <div className="text-xs text-slate-500">{t("card.tripFrom")}</div>
            <div className="text-2xl font-black text-slate-900">
              ${destination.estimatedCost.amount.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">
              {destination.estimatedCost.note}
            </div>
          </div>
          <Link
            href={tripHref}
            onClick={() =>
              track("destination_clicked", {
                destination: destination.name,
                country: destination.country,
                matchScore: destination.matchScore,
              })
            }
            className="rounded-full bg-[#34e0a1] px-5 py-2.5 text-sm font-black text-slate-900 transition hover:bg-[#2ccb91]"
          >
            {t("card.viewTrip")}
          </Link>
        </div>

        {/* Sources */}
        {destination.sources.length > 0 && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-700">
              {t("card.sources", { n: destination.sources.length })}
            </summary>
            <ul className="mt-1 space-y-0.5">
              {destination.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#00aa6c] hover:underline"
                  >
                    {s.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}

function RatingBubbles({ value }: { value: number }) {
  const bubbles = [];
  for (let i = 0; i < 5; i++) {
    const fill = Math.max(0, Math.min(1, value - i)); // 0, 0.5, or 1
    bubbles.push(
      <span
        key={i}
        className="relative inline-block h-3.5 w-3.5 rounded-full border-2 border-[#004f32]"
        aria-hidden
      >
        {fill > 0 && (
          <span
            className="absolute inset-0 rounded-full bg-[#004f32]"
            style={{
              clipPath:
                fill === 1 ? "inset(0 0 0 0)" : `inset(0 ${100 - fill * 100}% 0 0)`,
            }}
          />
        )}
      </span>,
    );
  }
  return <div className="flex items-center gap-0.5">{bubbles}</div>;
}
