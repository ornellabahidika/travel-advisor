"use client";

import { useEffect, useState } from "react";
import { TRANSLATIONS, type TKey } from "./translations";

export type Language = {
  code: string;
  label: string;
  flag: string;
  native: string;
};

export const LANGUAGES: Language[] = [
  { code: "en", label: "ENG", flag: "🇬🇧", native: "English" },
  { code: "es", label: "ESP", flag: "🇪🇸", native: "Español" },
  { code: "fr", label: "FRA", flag: "🇫🇷", native: "Français" },
  { code: "de", label: "DEU", flag: "🇩🇪", native: "Deutsch" },
  { code: "it", label: "ITA", flag: "🇮🇹", native: "Italiano" },
  { code: "pt", label: "POR", flag: "🇵🇹", native: "Português" },
  { code: "nl", label: "NLD", flag: "🇳🇱", native: "Nederlands" },
  { code: "pl", label: "POL", flag: "🇵🇱", native: "Polski" },
  { code: "ru", label: "RUS", flag: "🇷🇺", native: "Русский" },
  { code: "uk", label: "UKR", flag: "🇺🇦", native: "Українська" },
  { code: "sv", label: "SWE", flag: "🇸🇪", native: "Svenska" },
  { code: "da", label: "DAN", flag: "🇩🇰", native: "Dansk" },
  { code: "no", label: "NOR", flag: "🇳🇴", native: "Norsk" },
  { code: "fi", label: "FIN", flag: "🇫🇮", native: "Suomi" },
  { code: "is", label: "ISL", flag: "🇮🇸", native: "Íslenska" },
  { code: "el", label: "GRC", flag: "🇬🇷", native: "Ελληνικά" },
  { code: "cs", label: "CES", flag: "🇨🇿", native: "Čeština" },
  { code: "sk", label: "SVK", flag: "🇸🇰", native: "Slovenčina" },
  { code: "hu", label: "HUN", flag: "🇭🇺", native: "Magyar" },
  { code: "ro", label: "RON", flag: "🇷🇴", native: "Română" },
  { code: "bg", label: "BUL", flag: "🇧🇬", native: "Български" },
  { code: "sr", label: "SRP", flag: "🇷🇸", native: "Српски" },
  { code: "hr", label: "HRV", flag: "🇭🇷", native: "Hrvatski" },
  { code: "sl", label: "SLV", flag: "🇸🇮", native: "Slovenščina" },
  { code: "et", label: "EST", flag: "🇪🇪", native: "Eesti" },
  { code: "lv", label: "LVA", flag: "🇱🇻", native: "Latviešu" },
  { code: "lt", label: "LTU", flag: "🇱🇹", native: "Lietuvių" },
  { code: "tr", label: "TUR", flag: "🇹🇷", native: "Türkçe" },
  { code: "ja", label: "JPN", flag: "🇯🇵", native: "日本語" },
  { code: "ko", label: "KOR", flag: "🇰🇷", native: "한국어" },
  { code: "zh", label: "ZHO", flag: "🇨🇳", native: "中文 (简体)" },
  { code: "zh-TW", label: "ZHT", flag: "🇹🇼", native: "中文 (繁體)" },
  { code: "th", label: "THA", flag: "🇹🇭", native: "ไทย" },
  { code: "vi", label: "VIE", flag: "🇻🇳", native: "Tiếng Việt" },
  { code: "id", label: "IND", flag: "🇮🇩", native: "Bahasa Indonesia" },
  { code: "ms", label: "MSA", flag: "🇲🇾", native: "Bahasa Melayu" },
  { code: "tl", label: "FIL", flag: "🇵🇭", native: "Filipino" },
  { code: "hi", label: "HIN", flag: "🇮🇳", native: "हिन्दी" },
  { code: "bn", label: "BEN", flag: "🇧🇩", native: "বাংলা" },
  { code: "ur", label: "URD", flag: "🇵🇰", native: "اردو" },
  { code: "fa", label: "FAS", flag: "🇮🇷", native: "فارسی" },
  { code: "ar", label: "ARA", flag: "🇸🇦", native: "العربية" },
  { code: "he", label: "HEB", flag: "🇮🇱", native: "עברית" },
  { code: "sw", label: "SWA", flag: "🇰🇪", native: "Kiswahili" },
  { code: "am", label: "AMH", flag: "🇪🇹", native: "አማርኛ" },
  { code: "zu", label: "ZUL", flag: "🇿🇦", native: "isiZulu" },
  { code: "ga", label: "GLE", flag: "🇮🇪", native: "Gaeilge" },
  { code: "mt", label: "MLT", flag: "🇲🇹", native: "Malti" },
  { code: "ca", label: "CAT", flag: "🇪🇸", native: "Català" },
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
