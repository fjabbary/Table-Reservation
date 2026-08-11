import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, TableLocation } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { combineDateAndTime, findAvailableTables, validateSearchInput } from "./availability";

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
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(7); // 0-indexed
    expect(result?.getDate()).toBe(12);
    expect(result?.getHours()).toBe(19);
    expect(result?.getMinutes()).toBe(0);
  });

  it("rejects a calendar-invalid date (Feb 31)", () => {
    expect(combineDateAndTime("2026-02-31", "19:00")).toBeNull();
  });

  it("rejects malformed strings", () => {
    expect(combineDateAndTime("not-a-date", "19:00")).toBeNull();
    expect(combineDateAndTime("2026-08-12", "7pm")).toBeNull();
  });
});

describe("validateSearchInput", () => {
  const now = new Date(2026, 7, 10, 9, 0); // Aug 10, 2026, 9:00am

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
      { start: new Date(2026, 7, 12, 19, 0), end: new Date(2026, 7, 12, 20, 30), partySize: 4 },
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
        start: new Date(2026, 7, 12, 19, 0),
        end: new Date(2026, 7, 12, 20, 30),
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
        startTime: new Date(2026, 7, 12, 19, 0),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: new Date(2026, 7, 12, 19, 0), end: new Date(2026, 7, 12, 20, 30), partySize: 2 },
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
        startTime: new Date(2026, 7, 12, 18, 30),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: new Date(2026, 7, 12, 19, 0), end: new Date(2026, 7, 12, 20, 30), partySize: 2 },
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
        startTime: new Date(2026, 7, 12, 17, 30),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: new Date(2026, 7, 12, 19, 0), end: new Date(2026, 7, 12, 20, 30), partySize: 2 },
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
        startTime: new Date(2026, 7, 12, 20, 30),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: new Date(2026, 7, 12, 19, 0), end: new Date(2026, 7, 12, 20, 30), partySize: 2 },
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
        startTime: new Date(2026, 7, 12, 19, 0),
        partySize: 4,
        guestName: "Existing Guest",
        guestEmail: "existing@example.com",
        guestPhone: "555-0000",
      },
    });

    const results = await findAvailableTables(
      { start: new Date(2026, 7, 12, 19, 0), end: new Date(2026, 7, 12, 20, 30), partySize: 2 },
      testClient
    );

    expect(results.map((t) => t.id)).toEqual([tableA.id]);
  });
});
