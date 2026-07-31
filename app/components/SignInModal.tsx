"use client";

import { useState } from "react";
import { X, Mail, ArrowLeft, ArrowRight, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/language";
import { track } from "@/lib/analytics";

type View = "initial" | "email";

// TripAdvisor-style sign-in modal:
// - Big "Welcome to VoyPilot" heading with the brand mark
// - Continue with Google
// - Continue with email (opens single-email passwordless form)
// - Explicit "Continue as guest" option — no account needed; recents
//   and favourites still persist on this device via the "guest" key
// - Legal footer
export function SignInModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [view, setView] = useState<View>("initial");

  const continueAsGuest = () => {
    track("continued_as_guest");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          {view !== "initial" ? (
            <button
              onClick={() => setView("initial")}
              aria-label="Back"
              className="rounded-full p-1 text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-center pt-1">
          <BrandLogo />
        </div>

        <div className="px-8 pb-8 pt-4">
          {view === "initial" && (
            <>
              <h2 className="mb-1 text-center text-2xl font-black leading-tight text-[#004f32]">
                Welcome to VoyPilot
              </h2>
              <p className="mb-6 text-center text-sm text-slate-600">
                Save your trips, sync across devices, and unlock the full experience.
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    signInWithGoogle();
                    onClose();
                  }}
                  className="flex w-full items-center justify-center gap-3 rounded-full border border-[#004f32] bg-white px-5 py-3 text-base font-bold text-[#004f32] transition hover:bg-slate-50"
                >
                  <GoogleIcon className="h-5 w-5" />
                  Continue with Google
                </button>
                <button
                  onClick={() => setView("email")}
                  className="flex w-full items-center justify-center gap-3 rounded-full border border-[#004f32] bg-white px-5 py-3 text-base font-bold text-[#004f32] transition hover:bg-slate-50"
                >
                  <Mail className="h-5 w-5" />
                  Continue with email
                </button>
              </div>

              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500">
                <div className="h-px flex-1 bg-slate-200" />
                <span>or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                onClick={continueAsGuest}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-5 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-200"
              >
                <User className="h-5 w-5" />
                Continue as guest
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Guests can browse and plan freely — but favourites and trips only stay on this device.
              </p>
            </>
          )}

          {view === "email" && (
            <EmailView
              onSubmit={(email) => {
                signInWithEmail(email);
                onClose();
              }}
            />
          )}

          <LegalFooter t={t} />
        </div>
      </div>
    </div>
  );
}

function EmailView({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(email);
      }}
      className="space-y-4"
    >
      <h2 className="text-center text-2xl font-black leading-tight text-[#004f32]">
        Continue with email
      </h2>
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-slate-800">Email address</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-[#004f32] focus:outline-none focus:ring-1 focus:ring-[#004f32]"
          autoComplete="email"
          autoFocus
          required
        />
      </label>
      <button
        type="submit"
        disabled={!valid}
        className="w-full rounded-full bg-[#004f32] px-6 py-3 text-base font-bold text-white transition hover:bg-[#003b26] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue
      </button>
      <p className="text-center text-xs text-slate-500">
        We&apos;ll create your account automatically if it&apos;s your first time.
      </p>
    </form>
  );
}

function LegalFooter({ t }: { t: (k: TKeyStr) => string }) {
  return (
    <p className="mt-6 text-center text-xs leading-relaxed text-slate-600">
      {t("auth.termsPrefix")}{" "}
      <a href="#" className="underline hover:no-underline">
        {t("auth.termsOfUse")}
      </a>{" "}
      {t("auth.termsAnd")}{" "}
      <a href="#" className="underline hover:no-underline">
        {t("auth.privacyStatement")}
      </a>
      .
    </p>
  );
}

function BrandLogo() {
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-yellow-400 text-4xl shadow-md ring-2 ring-amber-200"
      aria-hidden
    >
      🧳
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-13.3l5.6-5.6A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.8 3l5.6-5.6A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 12.7 28.4l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.3 5.3C40.7 36.3 44 30.7 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

type TKeyStr = Parameters<ReturnType<typeof useT>["t"]>[0];
