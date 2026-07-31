"use client";

import Link from "next/link";
import { useState } from "react";
import { FavoritesButton } from "./FavoritesButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SignInModal } from "./SignInModal";
import { UserMenu } from "./UserMenu";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/language";

export function Header() {
  const { t } = useT();
  const { user } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);

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
          {user ? (
            <UserMenu />
          ) : (
            <button
              onClick={() => setSignInOpen(true)}
              className="rounded-full bg-[#004f32] px-3 py-1 text-xs font-bold text-white hover:bg-[#003b26] sm:px-4 sm:py-1.5 sm:text-sm"
            >
              {t("auth.signIn")}
            </button>
          )}
        </div>
      </div>

      {signInOpen && <SignInModal onClose={() => setSignInOpen(false)} />}
    </header>
  );
}
