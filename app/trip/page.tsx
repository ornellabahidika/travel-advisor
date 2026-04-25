"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TripPlanner } from "@/app/components/TripPlanner";

export default function TripPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = use(searchParams);

  const str = (k: string): string => {
    const v = params[k];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };

  const input = {
    name: str("name"),
    country: str("country"),
    origin: str("origin"),
    startDate: str("start"),
    endDate: str("end"),
    budget: parseInt(str("budget").replace(/[^0-9]/g, ""), 10) || 2000,
    currency: str("currency") || "USD",
    interests: str("interests")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    constraints: str("constraints"),
    vibe: str("vibe"),
    travelers: Math.max(1, parseInt(str("travelers").replace(/[^0-9]/g, ""), 10) || 1),
  };

  if (!input.name || !input.country) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400">
            Missing destination info.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  return <TripPlanner input={input} />;
}
