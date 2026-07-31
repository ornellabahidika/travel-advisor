"use client";

import { useEffect, useState } from "react";
import { TRANSLATIONS, type TKey } from "./translations";
import { track } from "./analytics";

export type Language = {
  code: string;
  label: string;
  flag: string;
  native: string;
};

// Only list languages that actually have a full translation dict in
// lib/translations.ts. Previously we shipped a picker with ~50 languages
// but only 8 dicts — picking any of the other 40+ silently fell back to
// English, which is exactly what the user reported as "language change
// not reflecting". Keep this list in sync with TRANSLATIONS when adding
// or removing dicts.
export const LANGUAGES: Language[] = [
  { code: "en", label: "ENG", flag: "🇬🇧", native: "English" },
  { code: "es", label: "ESP", flag: "🇪🇸", native: "Español" },
  { code: "fr", label: "FRA", flag: "🇫🇷", native: "Français" },
  { code: "de", label: "DEU", flag: "🇩🇪", native: "Deutsch" },
  { code: "it", label: "ITA", flag: "🇮🇹", native: "Italiano" },
  { code: "pt", label: "POR", flag: "🇵🇹", native: "Português" },
  { code: "ja", label: "JPN", flag: "🇯🇵", native: "日本語" },
  { code: "zh", label: "ZHO", flag: "🇨🇳", native: "中文 (简体)" },
];

const STORAGE_KEY = "tripfinder-language";
const CHANGE_EVENT = "tripfinder:language-changed";

export function useLanguage() {
  const [code, setCode] = useState<string>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) {
      setCode(stored);
    }
    const onChange = () => {
      const v = window.localStorage.getItem(STORAGE_KEY) ?? "en";
      setCode(v);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setLanguage = (next: string) => {
    if (next !== code) track("language_changed", { from: code, to: next });
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setCode(next);
  };

  const current = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

  return { code, current, setLanguage };
}

export function useT() {
  const { code } = useLanguage();
  const t = (key: TKey, vars?: Record<string, string | number>): string => {
    const dict = TRANSLATIONS[code] ?? TRANSLATIONS.en;
    let text = dict[key] ?? TRANSLATIONS.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };
  return { t, code };
}
