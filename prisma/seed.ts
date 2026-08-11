import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { generateReferenceNumber } from "../src/lib/reference-number";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const db = new PrismaClient({ adapter });

const DEFAULT_POLICY =
  "Tables are held for 15 minutes past the reservation time. Please contact us if you're running late.";
const PRIVATE_DINING_POLICY =
  "Private dining rooms require a minimum spend and are held for 15 minutes past the reservation time. Please contact us for cancellations.";
const PLACEHOLDER_IMAGE = "/placeholder-table.svg";

/** Build a Date `daysFromNow` days ahead, at the given local hour:minute. */
function atTime(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const tableSeeds = [
  {
    name: "Indoor Table 1",
    capacity: 2,
    location: "INDOOR" as const,
    description: "A cozy two-top tucked in a quiet corner of the main dining room.",
    features: "Quiet Corner",
    policies: DEFAULT_POLICY,
  },
  {
    name: "Indoor Table 2",
    capacity: 4,
    location: "INDOOR" as const,
    description: "A versatile four-top near the center of the main dining room.",
    features: null,
    policies: DEFAULT_POLICY,
  },
  {
    name: "Indoor Table 3",
    capacity: 6,
    location: "INDOOR" as const,
    description: "A larger table with a view of the street through our front windows.",
    features: "Window View",
    policies: DEFAULT_POLICY,
  },
  {
    name: "Indoor Table 4",
    capacity: 8,
    location: "INDOOR" as const,
    description: "Our biggest indoor table, great for groups, with wheelchair-accessible seating.",
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
    description: "Front-row seats at the bar, perfect for a casual bite and a drink.",
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
    description: "A private room with its own entrance, ideal for celebrations and business dinners.",
    features: "Private Area,AV Equipment",
    policies: PRIVATE_DINING_POLICY,
  },
  {
    name: "The Cedar Room",
    capacity: 12,
    location: "PRIVATE_DINING" as const,
    description: "Our largest private room, with a dedicated server and wheelchair-accessible entrance.",
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
      data: { ...seed, imageUrl: PLACEHOLDER_IMAGE },
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
      specialRequests: "Celebrating an anniversary, if a window-adjacent spot is possible.",
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
      specialRequests: "Birthday celebration, would like a small cake brought out after the meal.",
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

  console.log(`Seeded ${tableSeeds.length} tables and ${reservationSeeds.length} reservations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
