import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, TableLocation } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { RESTAURANT_TIMEZONE } from "@/lib/constants";
import { zonedTimeToUtc } from "@/lib/timezone";
import {
  combineDateAndTime,
  findAvailableTables,
  isTableAvailable,
  validateSearchInput,
} from "./availability";

/** Builds the same "wall clock at the restaurant" instant the app itself
 * uses, so these tests pass no matter what timezone actually runs them. */
function at(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return zonedTimeToUtc(year, month, day, hour, minute, RESTAURANT_TIMEZONE);
}

// Isolated SQLite file for this test run, separate from the real dev.db —
// pushed fresh from the current schema, then wiped between tests.
const TEST_DATABASE_URL = "file:./prisma/test.db";

let testClient: PrismaClient;

beforeAll(() => {
  execSync("npx prisma db push --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });

  const adapter = new PrismaBetterSqlite3({ url: TEST_DATABASE_URL });
  testClient = new PrismaClient({ adapter });
});

afterAll(async () => {
  await testClient.$disconnect();
});

beforeEach(async () => {
  await testClient.reservation.deleteMany();
  await testClient.table.deleteMany();
});

describe("combineDateAndTime", () => {
  it("parses a valid date and time", () => {
    const result = combineDateAndTime("2026-08-12", "19:00");
    expect(result).not.toBeNull();
    expect(result?.getTime()).toBe(at(2026, 8, 12, 19, 0).getTime());
  });

  it("rejects a calendar-invalid date (Feb 31)", () => {
    expect(combineDateAndTime("2026-02-31", "19:00")).toBeNull();
  });

  it("rejects malformed strings", () => {
    expect(combineDateAndTime("not-a-date", "19:00")).toBeNull();
    expect(combineDateAndTime("2026-08-12", "7pm")).toBeNull();
  });

  it("interprets times in the restaurant's timezone, not the host runtime's own timezone", () => {
    // Regression test: this used to be built with `new Date(y, m, d, h, min)`,
    // which uses whatever timezone the process happens to run in — correct by
    // coincidence in local dev, silently wrong on a server in a different zone
    // (e.g. UTC). 7:00 PM PDT (America/Los_Angeles, UTC-7 in August) is
    // 2:00 AM UTC the next day — this must hold regardless of the machine
    // (or CI runner) executing this test.
    const result = combineDateAndTime("2026-08-12", "19:00");
    expect(result?.toISOString()).toBe("2026-08-13T02:00:00.000Z");
  });
});

describe("validateSearchInput", () => {
  const now = at(2026, 8, 10, 9, 0); // Aug 10, 2026, 9:00am at the restaurant

  it("accepts a valid future request within operating hours", () => {
    const result = validateSearchInput({ date: "2026-08-12", time: "19:00", partySize: 4 }, now);
    expect(result.valid).toBe(true);
  });

  it("rejects a time in the past", () => {
    const result = validateSearchInput({ date: "2026-08-10", time: "08:00", partySize: 2 }, now);
    expect(result.valid).toBe(false);
  });

  it("rejects a time before opening", () => {
    const result = validateSearchInput({ date: "2026-08-12", time: "09:00", partySize: 2 }, now);
    expect(result.valid).toBe(false);
  });

  it("rejects a time that would run past closing", () => {
    // Closes at 22:00, 90-minute duration => last bookable start is 20:30
    const result = validateSearchInput({ date: "2026-08-12", time: "21:00", partySize: 2 }, now);
    expect(result.valid).toBe(false);
  });

  it("accepts the last bookable slot before closing", () => {
    const result = validateSearchInput({ date: "2026-08-12", time: "20:30", partySize: 2 }, now);
    expect(result.valid).toBe(true);
  });

  it("rejects a party size of zero", () => {
    const result = validateSearchInput({ date: "2026-08-12", time: "19:00", partySize: 0 }, now);
    expect(result.valid).toBe(false);
  });

  it("rejects a party size over the max", () => {
    const result = validateSearchInput({ date: "2026-08-12", time: "19:00", partySize: 99 }, now);
    expect(result.valid).toBe(false);
  });
});

describe("findAvailableTables", () => {
  it("excludes tables below the requested party size", async () => {
    await testClient.table.create({
      data: { name: "Small Table", capacity: 2, location: TableLocation.INDOOR },
    });
    const big = await testClient.table.create({
      data: { name: "Big Table", capacity: 6, location: TableLocation.INDOOR },
    });

    const results = await findAvailableTables(
      { start: at(2026, 8, 12, 19, 0), end: at(2026, 8, 12, 20, 30), partySize: 4 },
      testClient
    );

    expect(results.map((t) => t.id)).toEqual([big.id]);
  });

  it("filters by location when requested", async () => {
    const indoor = await testClient.table.create({
      data: { name: "Indoor A", capacity: 4, location: TableLocation.INDOOR },
    });
    await testClient.table.create({
      data: { name: "Patio A", capacity: 4, location: TableLocation.PATIO },
    });

    const results = await findAvailableTables(
      {
        start: at(2026, 8, 12, 19, 0),
        end: at(2026, 8, 12, 20, 30),
        partySize: 2,
        location: TableLocation.INDOOR,
      },
      testClient
    );

    expect(results.map((t) => t.id)).toEqual([indoor.id]);
  });

  it("excludes a table with an exactly overlapping reservation", async () => {
    const table = await testClient.table.create({
      data: { name: "Table 1", capacity: 4, location: TableLocation.INDOOR },
    });
    await testClient.reservation.create({
      data: {
        referenceNumber: "RES-TEST01",
        tableId: table.id,
        startTime: at(2026, 8, 12, 19, 0),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: at(2026, 8, 12, 19, 0), end: at(2026, 8, 12, 20, 30), partySize: 2 },
      testClient
    );

    expect(results).toHaveLength(0);
  });

  it("excludes a table with a partially overlapping reservation", async () => {
    const table = await testClient.table.create({
      data: { name: "Table 1", capacity: 4, location: TableLocation.INDOOR },
    });
    // Existing reservation 18:30-20:00, requested 19:00-20:30 -> overlaps
    await testClient.reservation.create({
      data: {
        referenceNumber: "RES-TEST02",
        tableId: table.id,
        startTime: at(2026, 8, 12, 18, 30),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: at(2026, 8, 12, 19, 0), end: at(2026, 8, 12, 20, 30), partySize: 2 },
      testClient
    );

    expect(results).toHaveLength(0);
  });

  it("allows a back-to-back booking right after an existing reservation ends", async () => {
    const table = await testClient.table.create({
      data: { name: "Table 1", capacity: 4, location: TableLocation.INDOOR },
    });
    // Existing reservation 17:30-19:00, requested starts exactly at 19:00 -> no overlap
    await testClient.reservation.create({
      data: {
        referenceNumber: "RES-TEST03",
        tableId: table.id,
        startTime: at(2026, 8, 12, 17, 30),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: at(2026, 8, 12, 19, 0), end: at(2026, 8, 12, 20, 30), partySize: 2 },
      testClient
    );

    expect(results.map((t) => t.id)).toEqual([table.id]);
  });

  it("allows a back-to-back booking right before an existing reservation starts", async () => {
    const table = await testClient.table.create({
      data: { name: "Table 1", capacity: 4, location: TableLocation.INDOOR },
    });
    // Existing reservation starts exactly when the requested one ends (20:30) -> no overlap
    await testClient.reservation.create({
      data: {
        referenceNumber: "RES-TEST04",
        tableId: table.id,
        startTime: at(2026, 8, 12, 20, 30),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: at(2026, 8, 12, 19, 0), end: at(2026, 8, 12, 20, 30), partySize: 2 },
      testClient
    );

    expect(results.map((t) => t.id)).toEqual([table.id]);
  });

  it("ignores a conflicting reservation on a different table", async () => {
    const tableA = await testClient.table.create({
      data: { name: "Table A", capacity: 4, location: TableLocation.INDOOR },
    });
    const tableB = await testClient.table.create({
      data: { name: "Table B", capacity: 4, location: TableLocation.INDOOR },
    });
    await testClient.reservation.create({
      data: {
        referenceNumber: "RES-TEST05",
        tableId: tableB.id,
        startTime: at(2026, 8, 12, 19, 0),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: at(2026, 8, 12, 19, 0), end: at(2026, 8, 12, 20, 30), partySize: 2 },
      testClient
    );

    expect(results.map((t) => t.id)).toEqual([tableA.id]);
  });
});

describe("isTableAvailable", () => {
  it("returns true when the table has no conflicting reservation", async () => {
    const table = await testClient.table.create({
      data: { name: "Table 1", capacity: 4, location: TableLocation.INDOOR },
    });

    const available = await isTableAvailable(
      table.id,
      { start: at(2026, 8, 12, 19, 0), end: at(2026, 8, 12, 20, 30) },
      testClient
    );

    expect(available).toBe(true);
  });

  it("returns false when the table has a conflicting reservation", async () => {
    const table = await testClient.table.create({
      data: { name: "Table 1", capacity: 4, location: TableLocation.INDOOR },
    });
    await testClient.reservation.create({
      data: {
        referenceNumber: "RES-TEST06",
        tableId: table.id,
        startTime: at(2026, 8, 12, 19, 0),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const available = await isTableAvailable(
      table.id,
      { start: at(2026, 8, 12, 19, 0), end: at(2026, 8, 12, 20, 30) },
      testClient
    );

    expect(available).toBe(false);
  });
});
