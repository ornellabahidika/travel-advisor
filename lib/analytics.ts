"use client";

import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
    autocapture: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
      maskTextSelector: "[data-ph-no-capture]",
    },
  });
  initialized = true;
}

export type EventName =
  | "search_submitted"
  | "destination_clicked"
  | "trip_plan_viewed"
  | "trip_plan_loaded"
  | "favorite_toggled"
  | "favorites_opened"
  | "group_trip_hosted"
  | "join_request_sent"
  | "signed_in"
  | "signed_out"
  | "continued_as_guest"
  | "language_changed"
  | "vibe_picked"
  | "things_to_do_expanded"
  | "restaurants_expanded"
  | "transport_book_clicked"
  | "flight_book_clicked"
  | "hotel_book_clicked"
  | "event_tickets_clicked";

export function track(event: EventName, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, props);
  } catch {
    // swallow — analytics must never break the app
  }
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    posthog.identify(userId, traits);
  } catch {
    // swallow
  }
}

export function reset() {
  if (typeof window === "undefined") return;
  try {
    posthog.reset();
  } catch {
    // swallow
  }
}
