"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, MapPin, Globe2, X } from "lucide-react";
import type { PlaceOption } from "@/lib/photon";

type Props = {
  value: string;
  onChange: (v: string) => void;
  // Static-string mode (used by the country picker — single-line rows, plain filter).
  suggestions?: string[];
  // Async mode (used by the city/airport pickers — momondo-style rich rows).
  loadOptions?: (query: string, signal: AbortSignal) => Promise<PlaceOption[]>;
  placeholder?: string;
  required?: boolean;
  className?: string;
  maxResults?: number;
  "aria-label"?: string;
};

type Row = { kind: "string"; value: string } | { kind: "place"; option: PlaceOption };

function rowLabel(r: Row): string {
  return r.kind === "string" ? r.value : r.option.value;
}

function PlaceIcon({ kind }: { kind: PlaceOption["kind"] }) {
  if (kind === "airport") return <Plane className="h-4 w-4 text-slate-500" />;
  if (kind === "country") return <Globe2 className="h-4 w-4 text-slate-500" />;
  return <MapPin className="h-4 w-4 text-slate-500" />;
}

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
  const [activeIdx, setActiveIdx] = useState(0);
  const [remoteResults, setRemoteResults] = useState<PlaceOption[]>([]);
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
    }, 180);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [value, loadOptions]);

  const rows: Row[] = useMemo(() => {
    if (loadOptions) {
      return remoteResults.slice(0, maxResults).map((option) => ({ kind: "place" as const, option }));
    }
    const list = suggestions ?? [];
    const q = value.trim().toLowerCase();
    if (!q) return list.slice(0, maxResults).map((value) => ({ kind: "string" as const, value }));
    const startsWith: string[] = [];
    const includes: string[] = [];
    for (const s of list) {
      const lower = s.toLowerCase();
      if (lower.startsWith(q)) startsWith.push(s);
      else if (lower.includes(q)) includes.push(s);
    }
    return [...startsWith, ...includes]
      .slice(0, maxResults)
      .map((value) => ({ kind: "string" as const, value }));
  }, [value, suggestions, loadOptions, remoteResults, maxResults]);

  // Reset highlight to first row whenever the result set changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [rows]);

  const pick = (label: string) => {
    onChange(label);
    setOpen(false);
  };

  const showPanel =
    open && (rows.length > 0 || (loadOptions && (loading || value.trim().length >= 2)));

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          required={required}
          aria-label={ariaLabel}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open) {
              if (e.key === "ArrowDown") setOpen(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(rows.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              if (activeIdx >= 0 && activeIdx < rows.length) {
                e.preventDefault();
                pick(rowLabel(rows[activeIdx]));
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
        {value && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("");
              setOpen(true);
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showPanel && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {loading && rows.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-400">Searching…</li>
          )}
          {!loading && rows.length === 0 && loadOptions && value.trim().length >= 2 && (
            <li className="px-4 py-3 text-sm text-slate-400">No matches</li>
          )}
          {rows.map((r, i) => {
            const label = rowLabel(r);
            const isActive = activeIdx === i;
            return (
              <li key={label} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(label);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                    isActive ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  {r.kind === "place" ? (
                    <>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <PlaceIcon kind={r.option.kind} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {r.option.name}
                        </span>
                        {r.option.sub && (
                          <span className="truncate text-xs text-slate-500">{r.option.sub}</span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-sm text-slate-700">{r.value}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
