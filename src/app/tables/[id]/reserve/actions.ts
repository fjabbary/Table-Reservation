"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { isTableAvailable, validateSearchInput } from "@/lib/availability";
import { generateReferenceNumber } from "@/lib/reference-number";
import type { TableLocation } from "@/generated/prisma/client";

const guestInfoSchema = z.object({
  guestName: z.string().trim().min(1, "Please enter your name.").max(100),
  guestEmail: z
    .string()
    .trim()
    .min(1, "Please enter your email.")
    .email("Please enter a valid email address.")
    .max(200),
  guestPhone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit phone number, digits only (e.g. 5551234567)."),
  specialRequests: z.string().trim().max(500).optional(),
});

/** Re-encodes everything the guest submitted (plus an error message, and
 * optionally a per-field error for each invalid input) so the form re-renders
 * prefilled — and with the exact fields that need fixing highlighted —
 * instead of making them start over. */
function buildRedirectUrl(
  tableId: string,
  formData: FormData,
  error: string,
  fieldErrors?: Record<string, string>
): string {
  const params = new URLSearchParams();
  for (const key of [
    "date",
    "time",
    "partySize",
    "location",
    "guestName",
    "guestEmail",
    "guestPhone",
    "specialRequests",
  ]) {
    const value = formData.get(key);
    if (typeof value === "string" && value) params.set(key, value);
  }
  params.set("error", error);
  if (fieldErrors) {
    for (const [field, message] of Object.entries(fieldErrors)) {
      params.set(`${field}Error`, message);
    }
  }
  return `/tables/${tableId}/reserve?${params.toString()}`;
}

export async function createReservation(formData: FormData): Promise<void> {
  const tableId = String(formData.get("tableId") ?? "");
  const locationRaw = formData.get("location");

  const searchResult = validateSearchInput({
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    partySize: Number(formData.get("partySize")),
    location:
      typeof locationRaw === "string" && locationRaw
        ? (locationRaw as TableLocation)
        : undefined,
  });

  if (!searchResult.valid) {
    redirect(buildRedirectUrl(tableId, formData, searchResult.error));
  }

  const guestParse = guestInfoSchema.safeParse({
    guestName: formData.get("guestName"),
    guestEmail: formData.get("guestEmail"),
    guestPhone: formData.get("guestPhone"),
    specialRequests: formData.get("specialRequests") || undefined,
  });

  if (!guestParse.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of guestParse.error.issues) {
      const field = String(issue.path[0]);
      if (!(field in fieldErrors)) fieldErrors[field] = issue.message; // keep the first message per field
    }
    redirect(
      buildRedirectUrl(tableId, formData, "Please fix the highlighted fields below.", fieldErrors)
    );
  }

  const table = await db.table.findUnique({ where: { id: tableId } });
  if (!table) {
    redirect(buildRedirectUrl(tableId, formData, "This table no longer exists."));
  }
  if (table.capacity < searchResult.value.partySize) {
    redirect(
      buildRedirectUrl(
        tableId,
        formData,
        `This table only seats up to ${table.capacity} guests.`
      )
    );
  }

  let referenceNumber: string;
  try {
    // Re-check availability and create the reservation inside one transaction,
    // so two guests can't both win a race for the same table/time.
    referenceNumber = await db.$transaction(async (tx) => {
      const stillFree = await isTableAvailable(tableId, searchResult.value, tx);
      if (!stillFree) throw new Error("CONFLICT");

      const ref = generateReferenceNumber();
      await tx.reservation.create({
        data: {
          referenceNumber: ref,
          tableId,
          startTime: searchResult.value.start,
          partySize: searchResult.value.partySize,
          guestName: guestParse.data.guestName,
          guestEmail: guestParse.data.guestEmail,
          guestPhone: guestParse.data.guestPhone,
          specialRequests: guestParse.data.specialRequests || null,
        },
      });
      return ref;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "CONFLICT") {
      redirect(
        buildRedirectUrl(
          tableId,
          formData,
          "Sorry — this table was just booked by someone else for that time."
        )
      );
    }
    throw err;
  }

  redirect(`/reservations/${referenceNumber}`);
}
