"use client";

import Link from "next/link";
import { useState } from "react";
import { FavoritesButton } from "./FavoritesButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SignInModal } from "./SignInModal";
import { UserMenu } from "./UserMenu";
import { useT } from "@/lib/language";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { t } = useT();
  const { user } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-yellow-400 text-xl shadow-sm ring-2 ring-amber-200">
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
              className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-bold text-white hover:bg-slate-700"
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
