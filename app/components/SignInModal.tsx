"use client";

import { useState } from "react";
import { X, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/language";

type View = "initial" | "email";

export function SignInModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [view, setView] = useState<View>("initial");
  const [comingSoon, setComingSoon] = useState<null | "Apple" | "Facebook">(null);

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

        <div className="flex justify-center pt-2">
          <BrandLogo />
        </div>

        <div className="px-8 pb-8 pt-4">
          <h2 className="mb-1 text-center text-2xl font-black leading-tight text-slate-900">
            Sign in or create an account
          </h2>
          <p className="mb-6 text-center text-sm text-slate-600">
            Save trips, sync across devices, and unlock the full VoyPilot experience.
          </p>

          {comingSoon && view === "initial" && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {comingSoon} sign-in is coming soon — for now please continue with Google or email.
            </div>
          )}

          {view === "initial" && (
            <InitialView
              onGoogle={() => {
                signInWithGoogle();
                onClose();
              }}
              onApple={() => setComingSoon("Apple")}
              onFacebook={() => setComingSoon("Facebook")}
              onEmail={() => {
                setComingSoon(null);
                setView("email");
              }}
            />
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

function InitialView({
  onGoogle,
  onApple,
  onFacebook,
  onEmail,
}: {
  onGoogle: () => void;
  onApple: () => void;
  onFacebook: () => void;
  onEmail: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <SocialPill onClick={onGoogle} icon={<GoogleIcon className="h-5 w-5" />}>
        Continue with Google
      </SocialPill>
      <SocialPill onClick={onApple} icon={<AppleIcon className="h-5 w-5" />}>
        Continue with Apple
      </SocialPill>
      <SocialPill onClick={onFacebook} icon={<FacebookIcon className="h-5 w-5" />}>
        Continue with Facebook
      </SocialPill>

      <div className="my-3 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-500">
        <div className="h-px flex-1 bg-slate-200" />
        <span>or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <SocialPill onClick={onEmail} icon={<Mail className="h-5 w-5" />}>
        Continue with email
      </SocialPill>
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
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-slate-800">Email address</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          autoComplete="email"
          autoFocus
          required
        />
      </label>
      <button
        type="submit"
        disabled={!valid}
        className="w-full rounded-full bg-slate-900 px-6 py-3.5 text-base font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue
      </button>
      <p className="text-center text-xs text-slate-500">
        We&apos;ll create your account automatically if it&apos;s your first time.
      </p>
    </form>
  );
}

function SocialPill({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-3 rounded-full border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 transition hover:border-slate-900 hover:bg-slate-50"
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="flex-1 text-center">{children}</span>
      <span className="h-5 w-5" />
    </button>
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
      className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-yellow-400 text-3xl shadow-md ring-2 ring-amber-200"
      aria-hidden
    >
      🧳
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-13.3l5.6-5.6A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.8 3l5.6-5.6A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 12.7 28.4l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.3 5.3C40.7 36.3 44 30.7 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.46 2.27-1.21 3.07-.78.83-2.06 1.49-3.13 1.4-.13-1.13.47-2.31 1.18-3.07.79-.85 2.13-1.49 3.16-1.4zM21 17.6c-.5 1.13-.74 1.64-1.39 2.65-.91 1.4-2.19 3.14-3.78 3.16-1.41.01-1.78-.92-3.7-.91-1.92.01-2.32.93-3.74.92-1.59-.01-2.8-1.59-3.71-2.99C2.04 16.5 1.74 11.74 3.31 9.16c1.12-1.85 2.89-2.93 4.55-2.93 1.69 0 2.76.93 4.16.93 1.36 0 2.18-.93 4.14-.93 1.48 0 3.05.81 4.16 2.21-3.66 2-3.07 7.23.68 9.16z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#1877F2" d="M24 12.07A12 12 0 1 0 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.69 4.55-4.69 1.32 0 2.7.24 2.7.24v2.97h-1.52c-1.5 0-1.97.93-1.97 1.89v2.26h3.35l-.54 3.49h-2.81V24A12 12 0 0 0 24 12.07z" />
      <path fill="#fff" d="M16.69 15.56l.54-3.49h-3.35V9.81c0-.96.47-1.89 1.97-1.89h1.52V4.95s-1.38-.24-2.7-.24c-2.75 0-4.55 1.67-4.55 4.69v2.66H7.08v3.49h3.05V24a12.04 12.04 0 0 0 3.75 0v-8.44h2.81z" />
    </svg>
  );
}

type TKeyStr = Parameters<ReturnType<typeof useT>["t"]>[0];
