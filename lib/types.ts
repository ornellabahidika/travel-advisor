import { z } from "zod";

export const TravelInputSchema = z.object({
  origin: z.string().min(1, "Where are you traveling from?").max(100),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  budget: z.coerce.number().int().positive("Budget must be positive"),
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD"]),
  climate: z.enum(["any", "warm", "cool", "tropical", "mild", "snowy"]),
  interests: z.array(z.string()).min(1, "Pick at least one interest"),
  vibe: z.string().max(300).optional().default(""),
  constraints: z.string().max(500).optional().default(""),
  travelers: z.coerce.number().int().min(1).max(12).default(1),
});

export type TravelInput = z.infer<typeof TravelInputSchema>;

export type Destination = {
  name: string;
  country: string;
  matchScore: number;
  whyItMatches: string;
  vibe: string;
  liveSignals: string[];
  counterSuggestion?: { name: string; reason: string };
  estimatedCost: { amount: number; currency: string; note: string };
  bestTimeNote: string;
  flightEstimate: { amount: number; currency: string; airline: string; live?: boolean };
  hotelNightEstimate: { amount: number; currency: string };
  images: { url: string; alt: string }[];
  sources: { title: string; url: string }[];
};

export type SuggestResponse =
  | { ok: true; destinations: Destination[]; reasoning: string }
  | { ok: false; error: string };

export const TripDetailsInputSchema = z.object({
  name: z.string().min(1),
  country: z.string().min(1),
  origin: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  budget: z.coerce.number().int().positive(),
  currency: z.string().min(1),
  interests: z.array(z.string()).default([]),
  constraints: z.string().optional().default(""),
  vibe: z.string().optional().default(""),
  travelers: z.coerce.number().int().min(1).max(12).default(1),
});

export type TripDetailsInput = z.infer<typeof TripDetailsInputSchema>;

export type FlightOption = {
  airline: string;
  approxPrice: number;
  currency: string;
  durationHours: number;
  stops: number;
  notes: string;
  bookingUrl: string;
  // True when the price came from a real flight pricing API (e.g.
  // Aviasales/Travelpayouts) rather than an LLM estimate. UI uses this
  // to drop the "Estimate" pill and change the CTA to "Book".
  isLive?: boolean;
};

export type HotelOption = {
  name: string;
  area: string;
  approxPricePerNight: number;
  currency: string;
  ratingOutOf5: number;
  highlights: string[];
  bookingUrl: string;
  imageUrl: string | null;
  isLive?: boolean;
};

export type Activity = {
  timeOfDay: "morning" | "afternoon" | "evening";
  title: string;
  description: string;
  estimatedCost: string;
};

export type ItineraryDay = {
  day: number;
  date: string;
  theme: string;
  activities: Activity[];
};

export type JoinRequestStatus = "pending" | "accepted" | "denied";

export type ChatMessage = {
  id: string;
  senderId: string; // "host" or requester id
  senderName: string;
  body: string;
  timestamp: number;
};

export type JoinRequest = {
  id: string;
  requesterName: string;
  requesterOrigin: string;
  message: string;
  daysAgo: number;
  status: JoinRequestStatus;
};

export type GroupTrip = {
  id: string;
  hostName: string;
  hostOrigin: string;
  hostVibe: string;
  startDate: string;
  endDate: string;
  travelersCount: number;
  capacity: number;
  focus: string[];
  blurb: string;
};

export type Review = {
  id: string;
  authorName: string;
  tripType: string;
  rating: number;
  title: string;
  body: string;
  daysAgo: number;
};

export type BudgetCategory =
  | "flights"
  | "lodging"
  | "food"
  | "activities"
  | "transport"
  | "misc";

export type BudgetLineItem = {
  category: BudgetCategory;
  amount: number;
  note: string;
};

export type BudgetBreakdown = {
  currency: string;
  total: number;
  perPerson: number;
  items: BudgetLineItem[];
};

export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  priceLevel: "$" | "$$" | "$$$" | "$$$$";
  rating: number;
  description: string;
  signatureDish: string;
  neighborhood: string;
  imageUrl: string | null;
  reservationUrl: string | null;
};

export type ThingCategory =
  | "sights"
  | "food"
  | "nature"
  | "culture"
  | "adventure"
  | "shopping"
  | "nightlife"
  | "wellness";

export type ThingToDo = {
  id: string;
  name: string;
  category: ThingCategory;
  description: string;
  location: string;
  duration: string;
  price: string;
  imageUrl: string | null;
  infoUrl: string | null;
};

export type TransportMode =
  | "transit"
  | "train"
  | "bike"
  | "rideshare"
  | "taxi"
  | "car_rental"
  | "walk";

export type TransportOption = {
  id: string;
  mode: TransportMode;
  title: string;
  description: string;
  howTo: string[];
  price: string;
  coverage: string;
  bookingUrl: string | null;
  recommended: boolean;
};

export type LocalEvent = {
  id: string;
  title: string;
  category:
    | "music"
    | "festival"
    | "sports"
    | "art"
    | "food"
    | "theater"
    | "cultural";
  startDate: string;
  endDate: string;
  venue: string;
  description: string;
  price: string;
  ticketUrl: string | null;
};

export type ReviewSummary = {
  averageRating: number;
  totalCount: number;
  breakdown: { stars: 1 | 2 | 3 | 4 | 5; count: number }[];
  reviews: Review[];
};

export type TripDetails = {
  heroImage: string | null;
  overview: string;
  insiderTips: string[];
  flights: FlightOption[];
  hotels: HotelOption[];
  itinerary: ItineraryDay[];
  totalEstimate: { amount: number; currency: string; breakdown: string };
  budgetBreakdown: BudgetBreakdown;
  groupTrips: GroupTrip[];
  reviews: ReviewSummary;
  events: LocalEvent[];
  transportation: TransportOption[];
  thingsToDo: ThingToDo[];
  restaurants: Restaurant[];
};

export type TripDetailsResponse =
  | { ok: true; details: TripDetails }
  | { ok: false; error: string };
