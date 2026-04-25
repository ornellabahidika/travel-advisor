"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Check,
  X,
  Plus,
  Waves,
  Mountain,
  UtensilsCrossed,
  Building2,
  PartyPopper,
  TreePine,
  Flower2,
  Compass,
  Car,
  Baby,
  Gem,
  PiggyBank,
} from "lucide-react";
import { useT } from "@/lib/language";
import type { TKey } from "@/lib/translations";

type VibePreset = {
  key: string;
  tkey: TKey;
  icon: React.ComponentType<{ className?: string }>;
  interests: string[];
};

export const VIBE_PRESETS: VibePreset[] = [
  { key: "beach", tkey: "vibe.beach", icon: Waves, interests: ["beaches", "wellness"] },
  { key: "mountain", tkey: "vibe.mountain", icon: Mountain, interests: ["hiking", "photography"] },
  { key: "food", tkey: "vibe.food", icon: UtensilsCrossed, interests: ["food", "history"] },
  { key: "city", tkey: "vibe.city", icon: Building2, interests: ["architecture", "art & museums", "shopping"] },
  { key: "nightlife", tkey: "vibe.nightlife", icon: PartyPopper, interests: ["nightlife", "festivals"] },
  { key: "nature", tkey: "vibe.nature", icon: TreePine, interests: ["wildlife", "off-the-beaten-path"] },
  { key: "wellness", tkey: "vibe.wellness", icon: Flower2, interests: ["wellness"] },
  { key: "adventure", tkey: "vibe.adventure", icon: Compass, interests: ["hiking", "off-the-beaten-path", "diving"] },
  { key: "roadtrip", tkey: "vibe.roadtrip", icon: Car, interests: ["photography", "off-the-beaten-path"] },
  { key: "family", tkey: "vibe.family", icon: Baby, interests: ["beaches", "wildlife"] },
  { key: "luxury", tkey: "vibe.luxury", icon: Gem, interests: ["wellness", "shopping", "food"] },
  { key: "budget", tkey: "vibe.budget", icon: PiggyBank, interests: ["off-the-beaten-path", "food"] },
];

export function VibeComboBox({
  values,
  onChange,
  onApplyInterests,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  onApplyInterests?: (interests: string[]) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VIBE_PRESETS;
    return VIBE_PRESETS.filter((v) => t(v.tkey).toLowerCase().includes(q));
  }, [query, t]);

  const isSelected = (label: string) =>
    values.some((v) => v.trim().toLowerCase() === label.trim().toLowerCase());

  const addTag = (label: string, interests?: string[]) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (isSelected(trimmed)) return;
    onChange([...values, trimmed]);
    if (interests && onApplyInterests) onApplyInterests(interests);
    setQuery("");
  };

  const removeTag = (label: string) => {
    onChange(values.filter((v) => v !== label));
  };

  const togglePreset = (preset: VibePreset) => {
    const label = t(preset.tkey);
    if (isSelected(label)) removeTag(label);
    else addTag(label, preset.interests);
  };

  const typedMatchesPreset = filtered.some(
    (v) => t(v.tkey).toLowerCase() === query.trim().toLowerCase(),
  );
  const showAddTyped = query.trim().length > 0 && !typedMatchesPreset;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm transition hover:border-slate-900"
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {values.length === 0 && (
            <span className="text-slate-400">{t("vibePicker.placeholder")}</span>
          )}
          {values.map((v) => (
            <span
              key={v}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(v);
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white hover:bg-slate-700"
            >
              {v}
              <X className="h-3 w-3" />
            </span>
          ))}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length === 1) togglePreset(filtered[0]);
                  else if (showAddTyped) addTag(query);
                } else if (e.key === "Backspace" && query === "" && values.length > 0) {
                  removeTag(values[values.length - 1]);
                }
              }}
              placeholder={t("vibePicker.placeholder")}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#00aa6c] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00aa6c]"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {showAddTyped && (
              <button
                type="button"
                onClick={() => addTag(query)}
                className="flex w-full items-center gap-3 border-b border-slate-100 bg-emerald-50 px-4 py-2.5 text-left text-sm font-semibold text-[#00aa6c] hover:bg-emerald-100"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#34e0a1] text-slate-900">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                {t("vibePicker.useTyped", { text: query.trim() })}
              </button>
            )}
            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("vibePicker.presetsLabel")}
            </div>
            <ul className="pb-2">
              {filtered.length === 0 && !showAddTyped ? (
                <li className="px-4 py-3 text-sm text-slate-500">—</li>
              ) : (
                filtered.map((preset) => {
                  const Icon = preset.icon;
                  const label = t(preset.tkey);
                  const selected = isSelected(label);
                  return (
                    <li key={preset.key}>
                      <button
                        type="button"
                        onClick={() => togglePreset(preset)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ${
                          selected
                            ? "bg-slate-50 font-bold text-slate-900"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            selected ? "bg-[#34e0a1] text-slate-900" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1">{label}</span>
                        {selected && <Check className="h-4 w-4 text-[#00aa6c]" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
