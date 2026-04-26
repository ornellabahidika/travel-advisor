"use client";

import { useState } from "react";
import { X, Mail, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/language";

type View = "initial" | "signin" | "join";

export function SignInModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();
  const [view, setView] = useState<View>("initial");

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
          <OwlLogo />
        </div>

        <div className="px-8 pb-8 pt-4">
          {view === "initial" && (
            <InitialView
              t={t}
              onGoogle={() => {
                signInWithGoogle();
                onClose();
              }}
              onEmail={() => setView("signin")}
            />
          )}

          {view === "signin" && (
            <SignInView
              t={t}
              onSubmit={(email) => {
                signInWithEmail(email);
                onClose();
              }}
              onSwitchToJoin={() => setView("join")}
            />
          )}

          {view === "join" && (
            <JoinView
              t={t}
              onSubmit={(first, last, email) => {
                signUpWithEmail(`${first} ${last}`, email);
                onClose();
              }}
              onSwitchToSignIn={() => setView("signin")}
            />
          )}

          <LegalFooter t={t} />
        </div>
      </div>
    </div>
  );
}

function InitialView({
  t,
  onGoogle,
  onEmail,
}: {
  t: (k: TKeyStr) => string;
  onGoogle: () => void;
  onEmail: () => void;
}) {
  return (
    <>
      <h2 className="mb-8 text-2xl font-black leading-tight text-[#004f32]">
        {t("auth.title")}
      </h2>
      <div className="space-y-3">
        <button
          onClick={onGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-[#004f32] bg-white px-5 py-3.5 text-base font-bold text-[#004f32] transition hover:bg-slate-50"
        >
          <GoogleIcon className="h-5 w-5" />
          {t("auth.continueGoogle")}
        </button>
        <button
          onClick={onEmail}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-[#004f32] bg-white px-5 py-3.5 text-base font-bold text-[#004f32] transition hover:bg-slate-50"
        >
          <Mail className="h-5 w-5" />
          {t("auth.continueEmail")}
        </button>
      </div>
    </>
  );
}

function SignInView({
  t,
  onSubmit,
  onSwitchToJoin,
}: {
  t: (k: TKeyStr) => string;
  onSubmit: (email: string) => void;
  onSwitchToJoin: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid = validEmail && password.length > 0;

  return (
    <>
      <h2 className="mb-6 text-2xl font-black leading-tight text-[#004f32]">
        {t("auth.welcomeBack")}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(email);
        }}
        className="space-y-4"
      >
        <LabeledInput label={t("auth.email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            className={`${textFieldCls} ph-no-capture`}
            data-ph-no-capture
            autoComplete="email"
            required
          />
        </LabeledInput>

        <LabeledInput label={t("auth.password")}>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.password")}
              className={`${textFieldCls} pr-10 ph-no-capture`}
              data-ph-no-capture
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </LabeledInput>

        <button
          type="button"
          className="text-sm font-bold text-[#004f32] hover:underline"
        >
          {t("auth.forgotPassword")}
        </button>

        <button
          type="submit"
          disabled={!valid}
          className="mt-2 w-full rounded-full bg-[#004f32] px-6 py-3.5 text-base font-bold text-white transition hover:bg-[#003b26] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("auth.signIn")}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-sm text-slate-600">
        <div className="h-px flex-1 bg-slate-200" />
        <span>{t("auth.notMember")}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <p className="text-center text-sm text-slate-700">
        <button
          onClick={onSwitchToJoin}
          className="font-bold text-[#004f32] underline hover:no-underline"
        >
          {t("auth.joinLink")}
        </button>{" "}
        to unlock the best of tripfinder.
      </p>
    </>
  );
}

function JoinView({
  t,
  onSubmit,
  onSwitchToSignIn,
}: {
  t: (k: TKeyStr) => string;
  onSubmit: (first: string, last: string, email: string) => void;
  onSwitchToSignIn: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    validEmail &&
    password.length >= 6;

  return (
    <>
      <h2 className="mb-6 text-2xl font-black leading-tight text-[#004f32]">
        {t("auth.joinTitle")}
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(firstName, lastName, email);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label={t("auth.firstName")}>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t("auth.firstName")}
              className={textFieldCls}
              required
            />
          </LabeledInput>
          <LabeledInput label={t("auth.lastName")}>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t("auth.lastName")}
              className={textFieldCls}
              required
            />
          </LabeledInput>
        </div>

        <LabeledInput label={t("auth.email")}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            className={`${textFieldCls} ph-no-capture`}
            data-ph-no-capture
            autoComplete="email"
            required
          />
        </LabeledInput>

        <LabeledInput label={t("auth.createPassword")}>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.password")}
              className={`${textFieldCls} pr-10 ph-no-capture`}
              data-ph-no-capture
              autoComplete="new-password"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </LabeledInput>

        <button
          type="submit"
          disabled={!valid}
          className="mt-2 w-full rounded-full bg-[#004f32] px-6 py-3.5 text-base font-bold text-white transition hover:bg-[#003b26] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("auth.joinAction")}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-sm text-slate-600">
        <div className="h-px flex-1 bg-slate-200" />
        <span>{t("auth.alreadyMember")}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <p className="text-center text-sm text-slate-700">
        <button
          onClick={onSwitchToSignIn}
          className="font-bold text-[#004f32] underline hover:no-underline"
        >
          {t("auth.signInLink")}
        </button>{" "}
        using your tripfinder account.
      </p>
    </>
  );
}

function LabeledInput({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-[#004f32]">
        {label}
      </span>
      {children}
    </label>
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

function OwlLogo() {
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
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-13.3l5.6-5.6A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.8 3l5.6-5.6A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 12.7 28.4l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.3 5.3C40.7 36.3 44 30.7 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const textFieldCls =
  "w-full rounded-lg border border-slate-300 bg-[#f4f4f0] px-3 py-2.5 text-sm text-slate-900 focus:border-[#004f32] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#004f32]";

type TKeyStr = Parameters<ReturnType<typeof useT>["t"]>[0];
