"use client";

import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Trash2, Users } from "lucide-react";
import { useRecents, removeRecentTrip, tripUrlFromRecent } from "@/lib/recents";
import { useT } from "@/lib/language";

export function ContinueSection() {
  const { items } = useRecents();
  const { t } = useT();

  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            {t("recents.title")}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{t("recents.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md"
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                removeRecentTrip(item.id);
              }}
              aria-label={t("recents.remove")}
              className="absolute right-3 top-3 rounded-full p-1 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-rose-600 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <div className="mb-3">
              <div className="text-lg font-black text-slate-900">{item.name}</div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3" />
                {item.country}
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#00aa6c]" />
                {item.startDate} → {item.endDate}
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#00aa6c]" />
                {item.travelers} · {item.budget.toLocaleString()} {item.currency}
              </div>
            </div>

            <Link
              href={tripUrlFromRecent(item)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#34e0a1] px-3 py-2 text-sm font-black text-slate-900 transition hover:bg-[#2ccb91]"
            >
              {t("recents.continue")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
