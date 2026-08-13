import { PrismaClient, TableLocation } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { generateReferenceNumber } from "../src/lib/reference-number";
import { RESTAURANT_TIMEZONE } from "../src/lib/constants";
import { getZonedParts, zonedTimeToUtc } from "../src/lib/timezone";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const db = new PrismaClient({ adapter });

const DEFAULT_POLICY =
  "Tables are held for 15 minutes past the reservation time. Please contact us if you're running late.";
const PRIVATE_DINING_POLICY =
  "Private dining rooms require a minimum spend and are held for 15 minutes past the reservation time. Please contact us for cancellations.";

// One representative photo per location, shared across all tables in that
// section (Unsplash direct-hotlink URLs, provided by the user).
const LOCATION_IMAGES: Record<TableLocation, string> = {
  INDOOR:
    "https://images.unsplash.com/photo-1658848541818-6cd64f678cba?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  PATIO:
    "https://plus.unsplash.com/premium_photo-1723491285855-f1035c4c703c?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  BAR: "https://images.unsplash.com/photo-1497644083578-611b798c60f3?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  PRIVATE_DINING:
    "https://images.unsplash.com/photo-1766832255363-c9f060ade8b0?q=80&w=744&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
};

/**
 * Build a Date `daysFromNow` days ahead of today (at the restaurant), at the
 * given hour:minute, restaurant-local — not the seed script's own runtime
 * timezone, which could be anything (a dev laptop vs. a cloud console).
 */
function atTime(daysFromNow: number, hour: number, minute = 0): Date {
  const today = getZonedParts(new Date(), RESTAURANT_TIMEZONE);
  // Pure calendar-date arithmetic in UTC (no wall-clock/DST ambiguity —
  // we're just adding days to a Y/M/D, not shifting an actual instant).
  const targetDay = new Date(Date.UTC(today.year, today.month - 1, today.day));
  targetDay.setUTCDate(targetDay.getUTCDate() + daysFromNow);

  return zonedTimeToUtc(
    targetDay.getUTCFullYear(),
    targetDay.getUTCMonth() + 1,
    targetDay.getUTCDate(),
    hour,
    minute,
    RESTAURANT_TIMEZONE
  );
}

const tableSeeds = [
  {
    name: "Indoor Table 1",
    capacity: 2,
    location: "INDOOR" as const,
    description:
      "A cozy two-top tucked in a quiet corner of the main dining room.",
    features: "Quiet Corner",
    policies: DEFAULT_POLICY,
  },
  {
    name: "Indoor Table 2",
    capacity: 4,
    location: "INDOOR" as const,
    description:
      "A versatile four-top near the center of the main dining room.",
    features: null,
    policies: DEFAULT_POLICY,
  },
  {
    name: "Indoor Table 3",
    capacity: 6,
    location: "INDOOR" as const,
    description:
      "A larger table with a view of the street through our front windows.",
    features: "Window View",
    policies: DEFAULT_POLICY,
  },
  {
    name: "Indoor Table 4",
    capacity: 8,
    location: "INDOOR" as const,
    description:
      "Our biggest indoor table, great for groups, with wheelchair-accessible seating.",
    features: "Window View,Wheelchair Accessible",
    policies: DEFAULT_POLICY,
  },
  {
    name: "Patio 1",
    capacity: 2,
    location: "PATIO" as const,
    description: "An intimate outdoor table on our string-lit patio.",
    features: "Outdoor,Pet Friendly",
    policies: DEFAULT_POLICY,
  },
  {
    name: "Patio 2",
    capacity: 4,
    location: "PATIO" as const,
    description: "A shaded patio table with a heater for cooler evenings.",
    features: "Outdoor,Heater,Pet Friendly",
    policies: DEFAULT_POLICY,
  },
  {
    name: "Bar Seat 1",
    capacity: 2,
    location: "BAR" as const,
    description:
      "Front-row seats at the bar, perfect for a casual bite and a drink.",
    features: "Bar View",
    policies: DEFAULT_POLICY,
  },
  {
    name: "Bar Seat 2",
    capacity: 3,
    location: "BAR" as const,
    description: "A slightly larger bar-top spot near the taps.",
    features: "Bar View",
    policies: DEFAULT_POLICY,
  },
  {
    name: "The Oak Room",
    capacity: 8,
    location: "PRIVATE_DINING" as const,
    description:
      "A private room with its own entrance, ideal for celebrations and business dinners.",
    features: "Private Area,AV Equipment",
    policies: PRIVATE_DINING_POLICY,
  },
  {
    name: "The Cedar Room",
    capacity: 12,
    location: "PRIVATE_DINING" as const,
    description:
      "Our largest private room, with a dedicated server and wheelchair-accessible entrance.",
    features: "Private Area,Wheelchair Accessible",
    policies: PRIVATE_DINING_POLICY,
  },
];

async function main() {
  // Wipe existing data so this script is safely re-runnable (`npm run db:seed`).
  await db.reservation.deleteMany();
  await db.table.deleteMany();

  const tables: Record<string, { id: string }> = {};
  for (const seed of tableSeeds) {
    const table = await db.table.create({
      data: { ...seed, imageUrl: LOCATION_IMAGES[seed.location] },
    });
    tables[seed.name] = table;
  }

  // A handful of pre-existing reservations, on a few different tables/days,
  // so the availability search has real conflicts to filter around.
  const reservationSeeds = [
    {
      table: "Indoor Table 2",
      startTime: atTime(1, 19, 0), // tomorrow 7:00pm
      partySize: 4,
      guestName: "Alice Kim",
      guestEmail: "alice.kim@example.com",
      guestPhone: "555-0101",
      specialRequests: null,
    },
    {
      table: "Patio 1",
      startTime: atTime(1, 18, 30), // tomorrow 6:30pm
      partySize: 2,
      guestName: "Marco Diaz",
      guestEmail: "marco.diaz@example.com",
      guestPhone: "555-0102",
      specialRequests:
        "Celebrating an anniversary, if a window-adjacent spot is possible.",
    },
    {
      table: "Indoor Table 2",
      startTime: atTime(2, 12, 30), // day after tomorrow, lunch
      partySize: 3,
      guestName: "Sam Lee",
      guestEmail: "sam.lee@example.com",
      guestPhone: "555-0103",
      specialRequests: "One guest has a gluten allergy.",
    },
    {
      table: "The Oak Room",
      startTime: atTime(3, 20, 0), // 3 days out, dinner
      partySize: 6,
      guestName: "Priya Shah",
      guestEmail: "priya.shah@example.com",
      guestPhone: "555-0104",
      specialRequests:
        "Birthday celebration, would like a small cake brought out after the meal.",
    },
  ];

  for (const seed of reservationSeeds) {
    const { table, ...data } = seed;
    await db.reservation.create({
      data: {
        ...data,
        tableId: tables[table].id,
        referenceNumber: generateReferenceNumber(),
      },
    });
  }

  console.log(
    `Seeded ${tableSeeds.length} tables and ${reservationSeeds.length} reservations.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
