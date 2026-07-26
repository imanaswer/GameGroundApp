/** Venues endpoints (§3.3) — the create-game stepper's venue + slot picker. */
import { api } from "./client";
import type { Venue, VenueSlot } from "./types";

export function list(): Promise<Venue[]> {
  return api.get<Venue[]>("/venues");
}

export function slots(venueId: string): Promise<VenueSlot[]> {
  return api.get<VenueSlot[]>(`/venues/${venueId}/slots`);
}
