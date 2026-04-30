"use client";

import Link from "next/link";
import { FavoritesButton } from "./FavoritesButton";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Sign-in is intentionally hidden for now. Recents persist locally via the
// "guest" key in lib/recents.ts, so users still pick up where they left off
// on the same device. Re-enable by restoring the SignInModal/UserMenu block.
export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-base font-black tracking-tight text-slate-900 sm:text-lg"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-yellow-400 text-sm shadow-sm ring-1 ring-amber-200 sm:h-8 sm:w-8 sm:text-base">
            🧳
          </span>
          VoyPilot
        </Link>

        <div className="flex items-center gap-2">
          <FavoritesButton />
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
