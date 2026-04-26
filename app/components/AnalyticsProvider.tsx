"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { initAnalytics } from "@/lib/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <Pageview />
      </Suspense>
      {children}
    </>
  );
}

function Pageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    posthog.capture("$pageview", {
      $pathname: pathname,
      $search: searchParams?.toString() || "",
    });
  }, [pathname, searchParams]);

  return null;
}
