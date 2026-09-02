"use client";

import Link from "next/link";
import { FavoritesButton } from "./FavoritesButton";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Sign-in is hidden until real Google OAuth + email magic-link auth is
// wired up (see conversation with Ornella — waiting on Google Cloud
// OAuth credentials + Resend API key). Recents and favourites still
// persist device-locally via the "guest" key in lib/recents.ts, so
// users pick up where they left off on the same browser without any
// auth. To re-enable: restore the SignInModal + UserMenu block from
// git history (previously in commit e2c9225).
export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-1.5 sm:px-6 sm:py-2">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-black tracking-tight text-slate-900 sm:text-lg"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-yellow-400 text-xs shadow-sm ring-1 ring-amber-200 sm:h-8 sm:w-8 sm:text-base">
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
