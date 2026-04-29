"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  suggestions?: string[];
  loadOptions?: (query: string, signal: AbortSignal) => Promise<string[]>;
  placeholder?: string;
  required?: boolean;
  className?: string;
  maxResults?: number;
  "aria-label"?: string;
};

export function Autocomplete({
  value,
  onChange,
  suggestions,
  loadOptions,
  placeholder,
  required,
  className,
  maxResults = 8,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [remoteResults, setRemoteResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  // Async remote search with debouncing + cancellation of stale requests.
  useEffect(() => {
    if (!loadOptions) return;
    const q = value.trim();
    if (q.length < 2) {
      setRemoteResults([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const results = await loadOptions(q, controller.signal);
        if (!controller.signal.aborted) {
          setRemoteResults(results);
          setLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setRemoteResults([]);
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [value, loadOptions]);

  const filtered = useMemo(() => {
    if (loadOptions) return remoteResults.slice(0, maxResults);
    const list = suggestions ?? [];
    const q = value.trim().toLowerCase();
    if (!q) return list.slice(0, maxResults);
    const startsWith: string[] = [];
    const includes: string[] = [];
    for (const s of list) {
      const lower = s.toLowerCase();
      if (lower.startsWith(q)) startsWith.push(s);
      else if (lower.includes(q)) includes.push(s);
    }
    return [...startsWith, ...includes].slice(0, maxResults);
  }, [value, suggestions, loadOptions, remoteResults, maxResults]);

  const pick = (label: string) => {
    onChange(label);
    setOpen(false);
    setActiveIdx(-1);
  };

  const showPanel =
    open && (filtered.length > 0 || (loadOptions && (loading || value.trim().length >= 2)));

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        required={required}
        aria-label={ariaLabel}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIdx(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === "ArrowDown") setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            if (activeIdx >= 0 && activeIdx < filtered.length) {
              e.preventDefault();
              pick(filtered[activeIdx]);
            } else {
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
        className={className}
        autoComplete="off"
      />
      {showPanel && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {loading && filtered.length === 0 && (
            <li className="px-4 py-2 text-sm text-slate-400">Searching…</li>
          )}
          {!loading && filtered.length === 0 && loadOptions && value.trim().length >= 2 && (
            <li className="px-4 py-2 text-sm text-slate-400">No matches</li>
          )}
          {filtered.map((s, i) => (
            <li key={s} role="option" aria-selected={activeIdx === i}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition ${
                  activeIdx === i
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
