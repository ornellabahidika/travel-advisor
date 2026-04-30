import type {
  BudgetBreakdown,
  Destination,
  GroupTrip,
  LocalEvent,
  Restaurant,
  ReviewSummary,
  SuggestResponse,
  ThingToDo,
  TransportOption,
  TravelInput,
  TripDetails,
  TripDetailsInput,
  TripDetailsResponse,
  ItineraryDay,
} from "./types";

const PICSUM = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/800`;

export function mockSuggest(input: TravelInput): SuggestResponse {
  const travelers = input.travelers || 1;
  const perPersonFlight = Math.round((input.budget * 0.3) / travelers);
  const flights = perPersonFlight * travelers;
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const perNight = Math.max(40, Math.round((input.budget - flights) / nights / 2));

  const destinations: Destination[] = [
    {
      name: "Lisbon",
      country: "Portugal",
      matchScore: 92,
      whyItMatches: `Lisbon fits your ${input.interests.slice(0, 2).join(" and ") || "vibe"} perfectly — mild spring weather, walkable old town, fado bars in Alfama, and it's one of the most affordable capitals in Western Europe for your ${input.currency} ${input.budget.toLocaleString()} budget.`,
      vibe: "Sun-faded tiles, tram bells, and grilled sardines",
      liveSignals: [
        "Forecast: 20-24°C, light breeze",
        "Eurovision-adjacent festivals active through May",
        "No visa required for US/EU travelers",
      ],
      counterSuggestion: {
        name: "Porto",
        reason: "30% cheaper, lighter crowds, and the Douro valley is right next door for a day trip.",
      },
      estimatedCost: {
        amount: input.budget,
        currency: input.currency,
        note: `~${nights} nights incl. flight`,
      },
      bestTimeNote: "Ideal in May — warm but not peak tourist",
      flightEstimate: {
        amount: flights,
        currency: input.currency,
        airline: "TAP Air Portugal",
      },
      hotelNightEstimate: { amount: perNight, currency: input.currency },
      images: [
        { url: PICSUM("lisbon-alfama"), alt: "Alfama rooftops, Lisbon" },
        { url: PICSUM("lisbon-tram"), alt: "Tram 28, Lisbon" },
      ],
      sources: [
        { title: "Lisbon travel guide — Time Out", url: "https://www.timeout.com/lisbon" },
        { title: "May weather in Lisbon", url: "https://www.weather-atlas.com/en/portugal/lisbon-weather-may" },
      ],
    },
    {
      name: "Split",
      country: "Croatia",
      matchScore: 87,
      whyItMatches: "Roman walls, island-hopping to Hvar and Brač, fresh seafood. Great late-spring value before summer prices kick in.",
      vibe: "Marble streets and Adriatic blue",
      liveSignals: [
        "Sea temp: 18-20°C, warming",
        "Ferry season to Hvar opens May 1",
        "New US direct flights since 2026",
      ],
      counterSuggestion: null as unknown as undefined,
      estimatedCost: {
        amount: Math.round(input.budget * 0.95),
        currency: input.currency,
        note: `~${nights} nights incl. flight`,
      },
      bestTimeNote: "Shoulder season — ideal",
      flightEstimate: {
        amount: Math.round(flights * 1.1),
        currency: input.currency,
        airline: "Croatia Airlines",
      },
      hotelNightEstimate: {
        amount: Math.round(perNight * 1.05),
        currency: input.currency,
      },
      images: [
        { url: PICSUM("split-croatia"), alt: "Split old town" },
        { url: PICSUM("hvar-island"), alt: "Hvar island coastline" },
      ],
      sources: [
        { title: "Split: a spring guide", url: "https://www.croatia.hr/en-gb/destinations/split" },
      ],
    },
    {
      name: "Oaxaca",
      country: "Mexico",
      matchScore: 84,
      whyItMatches: "World-class food scene, colonial architecture, mezcalerías, and proximity to mountain pueblos. Strong value for US travelers.",
      vibe: "Moles, mezcal, and mountain light",
      liveSignals: [
        "Dry season, 24-28°C",
        "Guelaguetza build-up — artisan markets active",
        "Peso-USD exchange favorable this month",
      ],
      counterSuggestion: {
        name: "Puebla",
        reason: "Similar colonial vibe, even cheaper, and 2hrs from CDMX if you want to split the trip.",
      },
      estimatedCost: {
        amount: Math.round(input.budget * 0.75),
        currency: input.currency,
        note: `~${nights} nights incl. flight — well under budget`,
      },
      bestTimeNote: "Comfortable dry spring",
      flightEstimate: {
        amount: Math.round(flights * 0.85),
        currency: input.currency,
        airline: "Aeromexico",
      },
      hotelNightEstimate: {
        amount: Math.round(perNight * 0.65),
        currency: input.currency,
      },
      images: [
        { url: PICSUM("oaxaca-mexico"), alt: "Oaxaca de Juárez" },
        { url: PICSUM("oaxaca-market"), alt: "Benito Juárez Market" },
      ],
      sources: [
        { title: "Oaxaca food guide", url: "https://www.saveur.com/oaxaca-food-guide" },
      ],
    },
    {
      name: "Reykjavík",
      country: "Iceland",
      matchScore: 76,
      whyItMatches: "If you want 'feel small' — glacier lagoons, black beaches, and empty Ring Road driving. Pushes the budget but pays off in raw landscape.",
      vibe: "Basalt, steam, and endless sky",
      liveSignals: [
        "18+ hrs daylight by late May",
        "Midnight sun begins May 21",
        "Puffin colonies return to Látrabjarg",
      ],
      counterSuggestion: null as unknown as undefined,
      estimatedCost: {
        amount: Math.round(input.budget * 1.15),
        currency: input.currency,
        note: `~${nights} nights — slightly over budget`,
      },
      bestTimeNote: "Late-spring sweet spot",
      flightEstimate: {
        amount: Math.round(flights * 1.1),
        currency: input.currency,
        airline: "Icelandair",
      },
      hotelNightEstimate: {
        amount: Math.round(perNight * 1.4),
        currency: input.currency,
      },
      images: [
        { url: PICSUM("iceland-reykjavik"), alt: "Hallgrímskirkja, Reykjavík" },
        { url: PICSUM("iceland-landscape"), alt: "Iceland landscape" },
      ],
      sources: [
        { title: "Iceland in May", url: "https://guidetoiceland.is/best-of-iceland/iceland-in-may" },
      ],
    },
  ];

  return {
    ok: true,
    destinations,
    reasoning: `We prioritized destinations with (a) current live-web signals favoring ${input.startDate.slice(0, 7)} travel, (b) your stated interests (${input.interests.slice(0, 3).join(", ") || "varied"}), and (c) total trip cost fitting within ${input.currency} ${input.budget.toLocaleString()} from ${input.origin || "your origin"}. Lisbon tops the list for the weather/cost/culture balance; Oaxaca is the hidden gem if you're flexible on Mexico.`,
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildItinerary(input: TripDetailsInput): ItineraryDay[] {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const themes = [
    {
      theme: "Old town wander",
      activities: [
        {
          timeOfDay: "morning" as const,
          title: `Walk the historic center of ${input.name}`,
          description: "Start at the main square, stroll the narrow streets, and grab coffee at a local café. Pace is slow, cobblestones are real.",
          estimatedCost: "Free + ~$4 coffee",
        },
        {
          timeOfDay: "afternoon" as const,
          title: "Local lunch + signature dish",
          description: "Sit down for the city's iconic dish — locals' favorite spots, not the tourist traps on the main strip.",
          estimatedCost: "~$18-25",
        },
        {
          timeOfDay: "evening" as const,
          title: "Sunset viewpoint + drinks",
          description: "Head to the best-known viewpoint for golden hour, then down for a drink at a neighborhood wine bar.",
          estimatedCost: "~$15 wine + apps",
        },
      ],
    },
    {
      theme: "Museum + market",
      activities: [
        {
          timeOfDay: "morning" as const,
          title: `Main museum of ${input.country}`,
          description: "Skip-the-line ticket recommended. Plan on 2-3 hours; the top floor is worth the climb.",
          estimatedCost: "~$15",
        },
        {
          timeOfDay: "afternoon" as const,
          title: "Central market lunch crawl",
          description: "Graze stalls for a lunch of small plates, meet local producers, pick up snacks for later.",
          estimatedCost: "~$20",
        },
        {
          timeOfDay: "evening" as const,
          title: "Live music bar",
          description: "Small venue with local musicians. Reserve a table if possible — weekends fill up.",
          estimatedCost: "~$25 cover + drink",
        },
      ],
    },
    {
      theme: "Day trip out of town",
      activities: [
        {
          timeOfDay: "morning" as const,
          title: "Train/ferry to nearby town",
          description: "30-60min out. Gets you to a more relaxed scene with fewer tourists and better value food.",
          estimatedCost: "~$12 round-trip",
        },
        {
          timeOfDay: "afternoon" as const,
          title: "Coastal/countryside walk",
          description: "Signposted trail, 2-3 hours. Bring water and sunscreen; the light at 4pm is magic.",
          estimatedCost: "Free",
        },
        {
          timeOfDay: "evening" as const,
          title: "Seafood dinner back in town",
          description: "Book a late table; evenings start at 8pm locally. Order the catch-of-the-day + house wine.",
          estimatedCost: "~$35",
        },
      ],
    },
    {
      theme: "Free-form + your interests",
      activities: [
        {
          timeOfDay: "morning" as const,
          title: `Pick based on your vibe: ${input.interests.slice(0, 2).join(", ") || "explore"}`,
          description: "Built-in buffer for whatever you gravitated toward in the first days — revisit a spot or go deeper.",
          estimatedCost: "Varies",
        },
        {
          timeOfDay: "afternoon" as const,
          title: "Neighborhood you missed",
          description: "Most cities have 1-2 districts travelers skip. Ask locals or your host — it's often the best afternoon.",
          estimatedCost: "Free + food",
        },
        {
          timeOfDay: "evening" as const,
          title: "Farewell dinner",
          description: "Splurge slightly on a spot you've been eyeing. Solo bar seats or a chef's table if available.",
          estimatedCost: "~$60",
        },
      ],
    },
  ];

  return Array.from({ length: nights }).map((_, i) => ({
    day: i + 1,
    date: addDays(input.startDate, i),
    theme: themes[i % themes.length].theme,
    activities: themes[i % themes.length].activities,
  }));
}

export function mockRestaurants(input: TripDetailsInput): Restaurant[] {
  const dest = input.name;
  const slug = dest.toLowerCase().replace(/\s+/g, "-");
  const search = (q: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`${q} ${dest}`)}`;

  return [
    {
      id: "rest-1",
      name: `${dest} Market Café`,
      cuisine: "Local · Cafe",
      priceLevel: "$",
      rating: 4.6,
      description: "Local favorite for breakfast and a long coffee. Seasonal pastries from a family-run bakery next door.",
      signatureDish: "Seasonal fruit tart + flat white",
      neighborhood: "Market district",
      imageUrl: PICSUM(`${slug}-rest-1`),
      reservationUrl: search(`market cafe reservation`),
    },
    {
      id: "rest-2",
      name: "Tasca do Porto",
      cuisine: "Traditional",
      priceLevel: "$$",
      rating: 4.8,
      description: "Tiny tavern locals fill on weeknights — no menu in English, which is part of the charm. Point at what your neighbor is having.",
      signatureDish: "Catch-of-the-day with olive oil potatoes",
      neighborhood: "Old Town",
      imageUrl: PICSUM(`${slug}-rest-2`),
      reservationUrl: search(`traditional tavern reservation`),
    },
    {
      id: "rest-3",
      name: "Bar Alma",
      cuisine: "Wine bar · Tapas",
      priceLevel: "$$",
      rating: 4.5,
      description: "Natural wine list and small plates. Stand at the bar for the best energy; tables are quieter but miss the scene.",
      signatureDish: "Grilled octopus + orange wine",
      neighborhood: "Bohemian quarter",
      imageUrl: PICSUM(`${slug}-rest-3`),
      reservationUrl: search(`natural wine bar`),
    },
    {
      id: "rest-4",
      name: `Chef ${dest[0]}'s Kitchen`,
      cuisine: "Modern · Tasting menu",
      priceLevel: "$$$$",
      rating: 4.9,
      description: "7-course tasting menu. Splurge night — book at least 3 weeks out. They do a pared-down lunch service if you want to save.",
      signatureDish: "Seasonal tasting menu",
      neighborhood: "Design district",
      imageUrl: PICSUM(`${slug}-rest-4`),
      reservationUrl: search(`tasting menu reservation`),
    },
    {
      id: "rest-5",
      name: "Rooftop Grill",
      cuisine: "Grill · Cocktails",
      priceLevel: "$$$",
      rating: 4.4,
      description: "Best sunset table in town. Go for drinks and a shared dish rather than a full meal — the food is good, the view is the star.",
      signatureDish: "Charred lamb shoulder + spritz",
      neighborhood: "City center",
      imageUrl: PICSUM(`${slug}-rest-5`),
      reservationUrl: search(`rooftop restaurant`),
    },
    {
      id: "rest-6",
      name: "Mae's Hole-in-the-Wall",
      cuisine: "Street food",
      priceLevel: "$",
      rating: 4.7,
      description: "Eight seats, one dish, cash only. Line forms at noon; be there by 11:45 on weekends.",
      signatureDish: "House noodle bowl",
      neighborhood: "Old Town backstreets",
      imageUrl: PICSUM(`${slug}-rest-6`),
      reservationUrl: null,
    },
    {
      id: "rest-7",
      name: "Garden Restaurant",
      cuisine: "Vegetarian",
      priceLevel: "$$",
      rating: 4.6,
      description: "Plant-forward menu in a hidden courtyard garden. Packed for lunch in summer; reservations recommended.",
      signatureDish: "Wood-fired vegetables + bread",
      neighborhood: "Residential",
      imageUrl: PICSUM(`${slug}-rest-7`),
      reservationUrl: search(`vegetarian garden restaurant`),
    },
    {
      id: "rest-8",
      name: "Pasteleria do Centro",
      cuisine: "Bakery · Desserts",
      priceLevel: "$",
      rating: 4.8,
      description: "Generations-old pastry shop. Skip the big tourist-branded ones — this is where locals bring out-of-town family.",
      signatureDish: "Classic regional pastry",
      neighborhood: "Old Town",
      imageUrl: PICSUM(`${slug}-rest-8`),
      reservationUrl: null,
    },
    {
      id: "rest-9",
      name: "Coastal Seafood House",
      cuisine: "Seafood",
      priceLevel: "$$$",
      rating: 4.5,
      description: "Whole grilled fish sold by weight. Order half if you're two — the portions are enormous.",
      signatureDish: "Whole grilled sea bass",
      neighborhood: "Waterfront",
      imageUrl: PICSUM(`${slug}-rest-9`),
      reservationUrl: search(`seafood restaurant reservation`),
    },
    {
      id: "rest-10",
      name: "Latenight Ramen",
      cuisine: "Asian · Noodles",
      priceLevel: "$$",
      rating: 4.4,
      description: "Open till 3am. Saves you after a night out; the broth is worth the wait.",
      signatureDish: "Slow-braised pork ramen",
      neighborhood: "Nightlife district",
      imageUrl: PICSUM(`${slug}-rest-10`),
      reservationUrl: null,
    },
  ];
}

export function mockThingsToDo(input: TripDetailsInput): ThingToDo[] {
  const dest = input.name;
  const slug = dest.toLowerCase().replace(/\s+/g, "-");
  const search = (q: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`${q} ${dest}`)}`;

  return [
    {
      id: "td-1",
      name: `${dest} Old Town walking tour`,
      category: "sights",
      description: "Two-hour guided walk through the historic center, covering the main landmarks with local context.",
      location: "Old Town",
      duration: "2 hrs",
      price: "Free (tip-based) or ~$20 paid",
      imageUrl: PICSUM(`${slug}-oldtown`),
      infoUrl: search(`free walking tour`),
    },
    {
      id: "td-2",
      name: "Rooftop sunset spot",
      category: "sights",
      description: "Locals' favorite rooftop bar with the best view of the city. Get there 30 min before sunset to grab a seat.",
      location: "City center",
      duration: "1-2 hrs",
      price: "$10-15 drink",
      imageUrl: PICSUM(`${slug}-rooftop`),
      infoUrl: search(`best sunset rooftop`),
    },
    {
      id: "td-3",
      name: `${dest} central market`,
      category: "food",
      description: "Sprawling food market — graze stalls for breakfast or lunch, pick up local spices and snacks for the road.",
      location: "Market district",
      duration: "1-3 hrs",
      price: "~$15 for lunch",
      imageUrl: PICSUM(`${slug}-market`),
      infoUrl: search(`central market`),
    },
    {
      id: "td-4",
      name: "Local food tour",
      category: "food",
      description: "Small-group walking food tour with 5-7 tasting stops. Best way to understand the local cuisine in 3 hours.",
      location: "Various neighborhoods",
      duration: "3 hrs",
      price: "$60-80",
      imageUrl: PICSUM(`${slug}-foodtour`),
      infoUrl: search(`food tour booking`),
    },
    {
      id: "td-5",
      name: "Hidden viewpoint hike",
      category: "nature",
      description: "Short uphill walk (45 min one way) to a panoramic viewpoint that 90% of tourists miss. Bring water.",
      location: "Outskirts",
      duration: "2-3 hrs round trip",
      price: "Free",
      imageUrl: PICSUM(`${slug}-hike`),
      infoUrl: search(`best hiking trails`),
    },
    {
      id: "td-6",
      name: "National museum",
      category: "culture",
      description: "Top museum for the country's history and art. The third floor is the highlight — give yourself at least 2 hours.",
      location: "Museum quarter",
      duration: "2-3 hrs",
      price: "$10-15",
      imageUrl: PICSUM(`${slug}-museum`),
      infoUrl: search(`national museum tickets`),
    },
    {
      id: "td-7",
      name: "Day trip to nearby village",
      category: "adventure",
      description: "Charming village 45 minutes away by train or bus. Worth a full day — lunch at a family-run tavern, then a vineyard or castle visit.",
      location: "Day-trip distance",
      duration: "Full day",
      price: "~$15 transport + meals",
      imageUrl: PICSUM(`${slug}-daytrip`),
      infoUrl: search(`best day trips`),
    },
    {
      id: "td-8",
      name: "Boat ride along the waterfront",
      category: "adventure",
      description: "1-hour scenic ride from the city pier. Sunset slot books up days ahead — reserve in advance.",
      location: "Waterfront",
      duration: "1 hr",
      price: "$25-35",
      imageUrl: PICSUM(`${slug}-boat`),
      infoUrl: search(`harbor boat tour`),
    },
    {
      id: "td-9",
      name: "Artisan workshop visit",
      category: "culture",
      description: "Small workshop where local craftspeople still make traditional ceramics/textiles. Buy direct, skip the tourist shops.",
      location: "Craft district",
      duration: "1 hr",
      price: "Free entry, items vary",
      imageUrl: PICSUM(`${slug}-workshop`),
      infoUrl: search(`artisan workshop visit`),
    },
    {
      id: "td-10",
      name: "Live music venue",
      category: "nightlife",
      description: "Tiny venue with local musicians most nights. Check the schedule for traditional/folk acts — those nights are the most magical.",
      location: "Bohemian quarter",
      duration: "2-3 hrs",
      price: "$15 cover + drinks",
      imageUrl: PICSUM(`${slug}-music`),
      infoUrl: search(`live music venue`),
    },
    {
      id: "td-11",
      name: "Spa / hammam afternoon",
      category: "wellness",
      description: "Authentic local bath house experience. Bring flip-flops, leave your phone in the locker, plan 2 hours minimum.",
      location: "City center",
      duration: "2-3 hrs",
      price: "$30-60",
      imageUrl: PICSUM(`${slug}-spa`),
      infoUrl: search(`traditional hammam spa`),
    },
    {
      id: "td-12",
      name: "Boutique shopping street",
      category: "shopping",
      description: "Pedestrian street with independent designers, vintage shops, and concept stores. Avoid the chain-store strips one block over.",
      location: "Design district",
      duration: "1-2 hrs",
      price: "Free to browse",
      imageUrl: PICSUM(`${slug}-shopping`),
      infoUrl: search(`independent boutique shopping`),
    },
  ];
}

export function mockTransportation(input: TripDetailsInput): TransportOption[] {
  const dest = input.name;
  const start = input.startDate;
  const end = input.endDate;
  const carRentalUrl = `https://www.kayak.com/cars/${encodeURIComponent(dest)}/${start}/${end}`;
  const bookingTransportUrl = `https://www.google.com/search?q=${encodeURIComponent(`${dest} public transport pass`)}`;
  const bikeUrl = `https://www.google.com/search?q=${encodeURIComponent(`${dest} bike share`)}`;

  return [
    {
      id: "transit",
      mode: "transit",
      title: `${dest} public transit`,
      description: `${dest}'s metro/bus network is the cheapest, most reliable way to get around the city. Runs from early morning to ~midnight.`,
      howTo: [
        "Pick up a rechargeable transit card at any metro station kiosk or vending machine (small one-time card fee, ~$0.50-2).",
        "Top up at machines or kiosks — a multi-day pass is usually best value if you're staying 3+ days.",
        "Tap on entry (and on exit on some systems) at the gates.",
        "Use the same card on metro, buses, trams, and often suburban trains.",
      ],
      price: "~$2 per ride · ~$15 day pass",
      coverage: "Citywide + airport in most cases",
      bookingUrl: bookingTransportUrl,
      recommended: true,
    },
    {
      id: "rideshare",
      mode: "rideshare",
      title: "Bolt / Uber / local rideshare",
      description: "Convenient for late nights, group trips, or when you've got luggage. Cheaper than street taxis in most cities.",
      howTo: [
        "Install Bolt or Uber on your phone before you go (some cities have local apps too — ask your hotel).",
        "Add a payment method (credit card or Apple/Google Pay).",
        "Set destination, request ride, watch the map until pickup.",
        "Tip in-app — usually 10% is generous.",
      ],
      price: "~$5-12 per ride in most cities",
      coverage: "Citywide, mostly 24/7",
      bookingUrl: "https://bolt.eu/en/cities/",
      recommended: false,
    },
    {
      id: "bike",
      mode: "bike",
      title: `${dest} bike share`,
      description: "Most cities now have a bike-share program — fastest way through historic centers and cheaper than transit if you're going short distances.",
      howTo: [
        `Sign up at the official ${dest} bike-share site or via app — usually a quick credit card registration.`,
        "Pick a day pass or per-ride pricing depending on how often you'll bike.",
        "Unlock at any docking station, ride, return to any other station.",
        "Watch for separate bike lanes and helmet rules — bring your own helmet if mandatory.",
      ],
      price: "~$2-5/day pass · ~$0.20/min after free window",
      coverage: "City center + popular neighborhoods",
      bookingUrl: bikeUrl,
      recommended: false,
    },
    {
      id: "car",
      mode: "car_rental",
      title: "Rental car (for day trips)",
      description: `Best if you're planning day trips outside ${dest} or to areas that aren't well connected by transit. Skip if you're staying in the city center — parking is often expensive and stressful.`,
      howTo: [
        "Book online before you arrive — walk-up rates at airports are 30-50% higher.",
        "Compare across aggregators (Kayak, Discover Cars, Rentalcars) for the best rate.",
        "Bring an International Driving Permit if your license isn't in Latin script.",
        "Check insurance — your credit card often covers basic CDW; full coverage adds ~$15-25/day.",
        "Pick up at airport (faster) or city office (no airport tax).",
      ],
      price: "~$25-60/day + fuel + parking",
      coverage: "Anywhere — best for excursions",
      bookingUrl: carRentalUrl,
      recommended: false,
    },
    {
      id: "walk",
      mode: "walk",
      title: "On foot",
      description: `Honestly the best way to experience ${dest}'s old town and main neighborhoods. Most sights are within 20-30 min walks of each other.`,
      howTo: [
        "Wear comfortable shoes — cobblestone is brutal on heels and thin soles.",
        "Download offline maps (Google Maps area download) before going out.",
        "Plan walking routes for cooler hours — early morning or evening is best in summer.",
      ],
      price: "Free",
      coverage: "Old town + central areas",
      bookingUrl: null,
      recommended: false,
    },
  ];
}

export function mockBudgetBreakdown(input: TripDetailsInput): BudgetBreakdown {
  const travelers = Math.max(1, input.travelers || 1);
  const total = input.budget;
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  const flights = Math.round(total * 0.32);
  const lodging = Math.round(total * 0.34);
  const food = Math.round(total * 0.18);
  const activities = Math.round(total * 0.1);
  const transport = Math.round(total * 0.04);
  const misc = total - (flights + lodging + food + activities + transport);

  return {
    currency: input.currency,
    total,
    perPerson: Math.round(total / travelers),
    items: [
      {
        category: "flights",
        amount: flights,
        note:
          travelers > 1
            ? `Round-trip × ${travelers} travelers`
            : "Round-trip",
      },
      {
        category: "lodging",
        amount: lodging,
        note: `${nights} night${nights > 1 ? "s" : ""} · ~${Math.round(lodging / nights)}/night`,
      },
      {
        category: "food",
        amount: food,
        note: `~${Math.round(food / nights)}/day · meals + drinks`,
      },
      {
        category: "activities",
        amount: activities,
        note: "Tours, museums, events",
      },
      {
        category: "transport",
        amount: transport,
        note: "Local transit, taxis, transfers",
      },
      {
        category: "misc",
        amount: misc,
        note: "Tips, souvenirs, buffer",
      },
    ],
  };
}

export function mockEvents(input: TripDetailsInput): LocalEvent[] {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const nights = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const addDaysLocal = (base: Date, d: number) => {
    const copy = new Date(base);
    copy.setDate(copy.getDate() + d);
    return copy.toISOString().slice(0, 10);
  };
  const dest = input.name;

  return [
    {
      id: "ev-1",
      title: `${dest} Food & Wine Festival`,
      category: "food",
      startDate: addDaysLocal(start, 1),
      endDate: addDaysLocal(start, 2),
      venue: `Main Square, ${dest}`,
      description: `Weekend-long tasting event with 40+ local producers, natural wine bars, and live DJ sets after sunset. Tickets include tastings; food paid separately.`,
      price: "€25 / person",
      ticketUrl: "https://www.google.com/search?q=food+wine+festival+" + encodeURIComponent(dest),
    },
    {
      id: "ev-2",
      title: `Night at the ${dest} Opera`,
      category: "theater",
      startDate: addDaysLocal(start, 2),
      endDate: addDaysLocal(start, 2),
      venue: `Teatro Nacional`,
      description: `Contemporary staging of La Traviata — sold out in most capitals, day-of availability here. Dress: smart casual. 8pm start.`,
      price: "€35–€95",
      ticketUrl: "https://www.google.com/search?q=opera+tickets+" + encodeURIComponent(dest),
    },
    {
      id: "ev-3",
      title: "Live at the Rooftop",
      category: "music",
      startDate: addDaysLocal(start, Math.min(3, Math.max(1, nights - 1))),
      endDate: addDaysLocal(start, Math.min(3, Math.max(1, nights - 1))),
      venue: "Alfama Rooftop Bar",
      description: `Local indie-folk trio, small venue, 10pm set. Arrive early for a table — it fills up by 9:30.`,
      price: "€15 cover + drinks",
      ticketUrl: null,
    },
    {
      id: "ev-4",
      title: `Street Art Walk — ${dest}`,
      category: "art",
      startDate: addDaysLocal(start, Math.min(2, Math.max(1, nights - 2))),
      endDate: addDaysLocal(start, Math.min(2, Math.max(1, nights - 2))),
      venue: "Meet at Praça do Comércio",
      description: `2-hour guided walk through the city's best murals with a local artist. Small groups (max 12), includes one coffee stop.`,
      price: "€18 / person",
      ticketUrl: "https://www.google.com/search?q=street+art+tour+" + encodeURIComponent(dest),
    },
    {
      id: "ev-5",
      title: `${dest} FC vs. Visiting Side`,
      category: "sports",
      startDate: addDaysLocal(start, Math.max(1, nights - 2)),
      endDate: addDaysLocal(start, Math.max(1, nights - 2)),
      venue: "Estádio Nacional",
      description: `League match against a top-table rival. Atmosphere is electric; buy from official channel to avoid counterfeits.`,
      price: "€20–€80",
      ticketUrl: "https://www.google.com/search?q=football+match+tickets+" + encodeURIComponent(dest),
    },
    {
      id: "ev-6",
      title: `Open-Air Jazz Night`,
      category: "festival",
      startDate: addDaysLocal(start, Math.max(1, nights - 1)),
      endDate: addDaysLocal(start, Math.max(1, nights - 1)),
      venue: "Riverside Park",
      description: `Free community event. Locals bring blankets and wine; food trucks on site. Starts at 7pm; headliner around 10pm.`,
      price: "Free",
      ticketUrl: null,
    },
  ];
}

export function mockReviews(input: TripDetailsInput): ReviewSummary {
  const destName = input.name;
  const reviews = [
    {
      id: "rv-1",
      authorName: "Sarah M.",
      tripType: "Solo traveler",
      rating: 5,
      title: `Fell in love with ${destName}`,
      body: `Spent a week wandering without a rigid plan and it was the best decision. The locals were warm, the food was unreal, and I felt safe walking home after dinner. Already planning a return trip.`,
      daysAgo: 12,
    },
    {
      id: "rv-2",
      authorName: "David & Priya",
      tripType: "Couple",
      rating: 5,
      title: "Perfect for our anniversary",
      body: `We splurged on one nice dinner and spent the rest on street food and cafés — honestly the cheap stuff was better. Take the walking tour on day one; it orients you and you'll meet other travelers.`,
      daysAgo: 28,
    },
    {
      id: "rv-3",
      authorName: "Marcus K.",
      tripType: "Friends trip",
      rating: 4,
      title: "Great trip, a few things to know",
      body: `Went with three friends and had a blast. Only ding: hotel area was quieter than expected at night — next time I'd stay one neighborhood over. Day trips out of town were the highlight.`,
      daysAgo: 45,
    },
    {
      id: "rv-4",
      authorName: "The Johnsons",
      tripType: "Family with kids",
      rating: 4,
      title: "Worked better than expected with kids",
      body: `Two kids (7 and 10). Pace was ambitious but everyone adjusted. Look into family-rate passes at museums — saved us a lot. Some cobblestone streets are tough with a stroller.`,
      daysAgo: 67,
    },
    {
      id: "rv-5",
      authorName: "Ava R.",
      tripType: "Solo traveler",
      rating: 5,
      title: "As a solo female, felt very safe",
      body: `Walked home late most nights, no issues. Plenty of cafés where solo diners blend in. I'd recommend staying close to the old town — everything is walkable from there.`,
      daysAgo: 90,
    },
    {
      id: "rv-6",
      authorName: "Tom W.",
      tripType: "Business trip",
      rating: 3,
      title: "Good for leisure, mid for business",
      body: `Wifi in my hotel was spotty and finding quiet coworking spots took effort. If you're combining work and play, book an apartment with reliable internet instead of a hotel room.`,
      daysAgo: 110,
    },
  ];

  const totalCount = 127 + Math.floor((destName.charCodeAt(0) * 7) % 200);
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  const averageRating = +(sum / reviews.length).toFixed(1);

  return {
    averageRating,
    totalCount,
    breakdown: [
      { stars: 5, count: Math.round(totalCount * 0.68) },
      { stars: 4, count: Math.round(totalCount * 0.21) },
      { stars: 3, count: Math.round(totalCount * 0.07) },
      { stars: 2, count: Math.round(totalCount * 0.03) },
      { stars: 1, count: Math.round(totalCount * 0.01) },
    ],
    reviews,
  };
}

export function mockTripDetails(input: TripDetailsInput): TripDetailsResponse {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const travelers = input.travelers || 1;
  const flightBase = Math.round(input.budget * 0.3);
  const perNightBase = Math.max(40, Math.round((input.budget - flightBase) / nights / 2));

  const destSlug = input.name.toLowerCase().replace(/\s+/g, "-");

  const details: TripDetails = {
    heroImage: PICSUM(`${destSlug}-hero`),
    overview: `${input.name}, ${input.country} is a strong pick for your ${input.startDate.slice(0, 7)} trip${travelers > 1 ? ` with ${travelers} travelers` : ""}. Expect a blend of walkable old town energy and accessible day trips. The ${input.currency} ${input.budget.toLocaleString()} budget covers comfortable mid-range lodging${travelers > 2 ? " (likely 2 rooms)" : ""}, two meals out per day, and one guided experience. Weather this week looks favorable; no known closures or travel advisories.`,
    insiderTips: [
      "Book museum passes online — the walk-up lines are 45+ min on weekends.",
      "Locals eat dinner late (after 8pm). Restaurants before 7pm are mostly tourists.",
      "Metro/tram passes pay for themselves at 3 rides — buy the day card.",
      "Tipping norm is round up or ~10%, not 18-20% like the US.",
      `The neighborhood locals actually go out in isn't the one your hotel recommends — ask a bartender which district they'd pick on a Friday.`,
    ],
    flights: [
      {
        airline: "Local Carrier",
        approxPrice: Math.round(flightBase * 0.9 * travelers),
        currency: input.currency,
        durationHours: 8,
        stops: 0,
        notes: `Cheapest direct — overnight outbound${travelers > 1 ? ` (${travelers} travelers)` : ""}`,
        bookingUrl: `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(input.origin)}+to+${encodeURIComponent(input.name)}`,
      },
      {
        airline: "Major Alliance",
        approxPrice: Math.round(flightBase * travelers),
        currency: input.currency,
        durationHours: 10,
        stops: 1,
        notes: `One stop, easier schedule${travelers > 1 ? ` (${travelers} travelers)` : ""}`,
        bookingUrl: "https://www.google.com/travel/flights",
      },
      {
        airline: "Premium Carrier",
        approxPrice: Math.round(flightBase * 1.3 * travelers),
        currency: input.currency,
        durationHours: 9,
        stops: 0,
        notes: `Direct premium economy${travelers > 1 ? ` (${travelers} travelers)` : ""}`,
        bookingUrl: "https://www.google.com/travel/flights",
      },
    ],
    hotels: [
      {
        name: `Hotel Central ${input.name}`,
        area: "Old Town",
        approxPricePerNight: Math.round(perNightBase * 0.9),
        currency: input.currency,
        ratingOutOf5: 4.4,
        highlights: ["Walk to every major sight", "Rooftop breakfast", "Quiet rooms facing courtyard"],
        bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(input.name)}`,
        imageUrl: PICSUM(`${destSlug}-hotel-1`),
      },
      {
        name: `Boutique ${input.name} Suites`,
        area: "Artsy district",
        approxPricePerNight: perNightBase,
        currency: input.currency,
        ratingOutOf5: 4.6,
        highlights: ["Design-forward rooms", "Free bike rental", "Wine bar on ground floor"],
        bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(input.name)}`,
        imageUrl: PICSUM(`${destSlug}-hotel-2`),
      },
      {
        name: `${input.name} Garden B&B`,
        area: "Residential neighborhood",
        approxPricePerNight: Math.round(perNightBase * 0.7),
        currency: input.currency,
        ratingOutOf5: 4.7,
        highlights: ["Home-cooked breakfast", "Host doubles as trip advisor", "Far from crowds"],
        bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(input.name)}`,
        imageUrl: PICSUM(`${destSlug}-hotel-3`),
      },
      {
        name: `Riverside Lofts`,
        area: "Waterfront",
        approxPricePerNight: Math.round(perNightBase * 1.25),
        currency: input.currency,
        ratingOutOf5: 4.5,
        highlights: ["Kitchen + laundry", "Great for 3+ nights", "Walking tour meeting point next door"],
        bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(input.name)}`,
        imageUrl: PICSUM(`${destSlug}-hotel-4`),
      },
    ],
    itinerary: buildItinerary(input),
    totalEstimate: {
      amount: input.budget,
      currency: input.currency,
      breakdown: `Flights ~${flightBase} + ${nights} nights lodging + food/activities`,
    },
    events: mockEvents(input),
    reviews: mockReviews(input),
    budgetBreakdown: mockBudgetBreakdown(input),
    transportation: mockTransportation(input),
    thingsToDo: mockThingsToDo(input),
    restaurants: mockRestaurants(input),
    groupTrips: [
      {
        id: "grp-1",
        hostName: "Maria L.",
        hostOrigin: "Barcelona",
        hostVibe: "solo female traveler, 32, designer",
        startDate: addDays(input.startDate, -1),
        endDate: addDays(input.endDate, 1),
        travelersCount: 2,
        capacity: 4,
        focus: ["food", "design", "photography"],
        blurb: "Chill pace, long lunches, mornings for exploring. Looking for 1-2 more who don't mind taking it slow and actually sitting at cafés for an hour.",
      },
      {
        id: "grp-2",
        hostName: "James K.",
        hostOrigin: "Toronto",
        hostVibe: "couple in their 30s, first Europe trip",
        startDate: input.startDate,
        endDate: input.endDate,
        travelersCount: 2,
        capacity: 6,
        focus: ["hiking", "history", "local food"],
        blurb: "Partner and I want to split Airbnb cost and group up for day trips. Active but not extreme — think coastal walks, castle visits, good dinners.",
      },
      {
        id: "grp-3",
        hostName: "Priya S.",
        hostOrigin: "London",
        hostVibe: "digital nomads, 3 friends",
        startDate: addDays(input.startDate, 2),
        endDate: addDays(input.endDate, 3),
        travelersCount: 3,
        capacity: 5,
        focus: ["coworking", "nightlife", "live music"],
        blurb: "Mornings we work, afternoons + evenings we play. Looking for people who've done a nomad-style trip before and can hold their own.",
      },
    ],
  };

  return { ok: true, details };
}

export function isMockMode(): boolean {
  return process.env.USE_MOCK_API === "true" || process.env.USE_MOCK_API === "1";
}

export function mockDelay(ms = 1500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Three plausible "other travelers headed there too" group-trip mockups.
// Always shown — the section is explicitly labelled as a demo listing of
// what real matchmaking would look like once we wire it up.
export function mockGroupTrips(input: TripDetailsInput): GroupTrip[] {
  const shiftDate = (iso: string, days: number): string => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const interests = input.interests.length > 0 ? input.interests : ["culture", "food"];
  const interest1 = interests[0] ?? "culture";
  const interest2 = interests[1] ?? "food";
  return [
    {
      id: "grp-1",
      hostName: "Maya L.",
      hostOrigin: "Berlin, Germany",
      hostVibe: "solo female traveler, late 20s",
      startDate: shiftDate(input.startDate, -1),
      endDate: shiftDate(input.endDate, 1),
      travelersCount: 1,
      capacity: 3,
      focus: [interest1, "photography", "slow travel"],
      blurb: `Heading to ${input.name} for a slower week — mornings in cafés, afternoons wandering, evenings somewhere local. Looking for 1-2 chill people who don't need a packed itinerary.`,
    },
    {
      id: "grp-2",
      hostName: "Jordan K.",
      hostOrigin: "Toronto, Canada",
      hostVibe: "couple in their 30s",
      startDate: shiftDate(input.startDate, 0),
      endDate: shiftDate(input.endDate, 2),
      travelersCount: 2,
      capacity: 4,
      focus: [interest2, "nightlife", "live music"],
      blurb: `Quick trip with my partner — we love finding the spots locals actually go. Open to splitting an Airbnb with another couple or two friends who are easygoing.`,
    },
    {
      id: "grp-3",
      hostName: "Priya R.",
      hostOrigin: "London, UK",
      hostVibe: "friends from university",
      startDate: shiftDate(input.startDate, 2),
      endDate: shiftDate(input.endDate, 0),
      travelersCount: 3,
      capacity: 6,
      focus: [interest1, "hiking", "off the beaten path"],
      blurb: `Three of us going to ${input.name} — booked the place, planned a couple of hikes, the rest is open. Friendly group, no pressure to do everything together.`,
    },
  ];
}
