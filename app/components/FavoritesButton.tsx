"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/language";
import { track } from "@/lib/analytics";

export function FavoritesButton() {
  const { count } = useFavorites();
  const { t } = useT();

  return (
    <Link
      href="/favorites"
      onClick={() => track("favorites_opened", { count })}
      className="relative inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-bold text-slate-900 hover:bg-slate-100"
    >
      <Heart className={`h-4 w-4 ${count > 0 ? "fill-rose-500 text-rose-500" : ""}`} />
      {t("header.favorites")}
      {count > 0 && (
        <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
