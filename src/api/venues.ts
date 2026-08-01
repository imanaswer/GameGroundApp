/**
 * Venues endpoints (§3.3) — the create-game stepper's venue + slot picker.
 *
 * Like games (§4.2), the live web routes don't return the app's view vocabulary 1:1, so this is
 * the single reconciliation point. The slot list in particular is envelope- and field-name-tolerant:
 * a slot is treated as bookable UNLESS the server explicitly says otherwise, so a payload that omits
 * an `available` flag (or names it `isBooked`, etc.) no longer renders an empty picker.
 */
import { api } from "./client";
import type { Venue, VenueSlot } from "./types";

type Raw = Record<string, unknown>;

/** Accept a bare array or a `{ data | items | venues | slots }` envelope. */
function unwrap(raw: unknown, ...keys: string[]): Raw[] {
  if (Array.isArray(raw)) return raw as Raw[];
  if (raw && typeof raw === "object") {
    for (const k of keys) {
      const v = (raw as Raw)[k];
      if (Array.isArray(v)) return v as Raw[];
    }
  }
  return [];
}

function str(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === "string" && v.length) return v;
  return null;
}

function toVenue(r: Raw): Venue {
  return {
    id: String(r.id ?? r.venueId ?? ""),
    name: str(r.name, r.title) ?? "Venue",
    area: str(r.area, r.locality, r.address, r.location),
  };
}

function toSlot(r: Raw): VenueSlot | null {
  const startsAt = str(r.startsAt, r.startTime, r.start, r.scheduledAt, r.from);
  if (!startsAt) return null; // a slot with no start time can't be shown or picked
  // Bookable by default; only an explicit negative signal marks it unavailable.
  // A slot in the past is one such signal: the server validates the schedule at create time
  // (past + a 15-min buffer), so offering it would only produce a rejected game.
  const started = new Date(startsAt).getTime() <= Date.now();
  const unavailable =
    started ||
    r.available === false || r.isAvailable === false || r.booked === true || r.isBooked === true;
  return {
    id: String(r.id ?? r.slotId ?? startsAt),
    startsAt,
    endsAt: str(r.endsAt, r.endTime, r.end, r.to) ?? startsAt,
    available: !unavailable,
  };
}

export async function list(): Promise<Venue[]> {
  const raw = await api.get<unknown>("/venues");
  return unwrap(raw, "data", "items", "venues")
    .map(toVenue)
    .filter((v) => v.id);
}

export async function slots(venueId: string): Promise<VenueSlot[]> {
  const raw = await api.get<unknown>(`/venues/${venueId}/slots`);
  return unwrap(raw, "data", "items", "slots")
    .map(toSlot)
    .filter((s): s is VenueSlot => s !== null);
}
