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
  const sports = Array.isArray(r.supportedSports) ? r.supportedSports : Array.isArray(r.sports) ? r.sports : [];
  const open = r.openSlots ?? r.availableSlots;
  return {
    id: String(r.id ?? r.venueId ?? ""),
    name: str(r.name, r.title) ?? "Venue",
    area: str(r.area, r.locality, r.address, r.location),
    supportedSports: sports.filter((s): s is string => typeof s === "string" && s.length > 0),
    // Absent ≠ zero. `null` means "the server didn't say", which the UI renders as nothing rather
    // than as "No open slots" — the latter would libel every venue on an older payload.
    openSlots: typeof open === "number" && Number.isFinite(open) ? open : null,
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

/**
 * Approved venues, **for one sport**.
 *
 * `sport` is not optional decoration: `GET /venues` unfiltered returns every ACTIVE venue in the
 * system (11 of them today), so the create flow was offering football turfs to someone hosting
 * badminton — the venue list simply had nothing to do with the sport chosen a step earlier. The web
 * flow has always sent `?sport=`, and the server filters on `supportedSports`; the app just never
 * passed it. Reported by Anaswer.
 *
 * Omitting `sport` still queries the whole list, which is the right behaviour for any caller that
 * genuinely wants every venue — but the create picker must pass one.
 */
export async function list(sport?: string | null): Promise<Venue[]> {
  const query = sport ? `?sport=${encodeURIComponent(sport)}` : "";
  const raw = await api.get<unknown>(`/venues${query}`);
  const venues = unwrap(raw, "data", "items", "venues")
    .map(toVenue)
    .filter((v) => v.id);

  // Defence in depth, not distrust: the server does filter. But this list is cached for 5 minutes
  // client-side and 60s at the edge, so a response fetched before a sport was selected — or by an
  // older build — can still be in hand, and putting a table-tennis court in a badminton flow is the
  // exact bug being fixed. Only venues that DECLARE their sports are judged: an empty list means
  // "unknown", and dropping those would empty the picker the moment the field is renamed.
  if (!sport) return venues;
  return venues.filter((v) => v.supportedSports.length === 0 || v.supportedSports.includes(sport));
}

export async function slots(venueId: string): Promise<VenueSlot[]> {
  const raw = await api.get<unknown>(`/venues/${venueId}/slots`);
  return unwrap(raw, "data", "items", "slots")
    .map(toSlot)
    .filter((s): s is VenueSlot => s !== null);
}
