"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { useAuth, initialsOf } from "@/lib/auth";
import { useT } from "@/lib/language";

export function UserMenu() {
  const { t } = useT();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!user) return null;
  const initials = initialsOf(user.name);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pl-1 pr-3 text-sm font-bold text-slate-900 hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
          {initials}
        </span>
        <span className="hidden max-w-[120px] truncate sm:inline">{user.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {t("auth.signedInAs")}
            </div>
            <div className="mt-0.5 truncate text-sm font-bold text-slate-900">{user.name}</div>
            <div className="truncate text-xs text-slate-500">{user.email}</div>
            {user.provider === "google" && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                Google
              </div>
            )}
          </div>
          <button
            onClick={() => {
              signOut();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            {t("auth.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
