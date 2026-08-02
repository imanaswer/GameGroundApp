/**
 * Display formatting for server values. The app never computes money — it only
 * *renders* the server's paise, so this is presentation, not calculation.
 */

/** null/absent/non-finite paise → null (caller shows "FREE"); else "₹120" style, whole rupees. */
export function formatPrice(pricePaise: number | null | undefined): string | null {
  if (pricePaise == null || pricePaise === 0 || !Number.isFinite(pricePaise)) return null;
  const rupees = pricePaise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}

/** Amount for the checkout sheet — always shows a value (₹0 never reaches paid flow). */
export function formatAmount(pricePaise: number): string {
  return `₹${(pricePaise / 100).toLocaleString("en-IN")}`;
}

/** Registration capacity caption: "30 spots left" / "5 registered · 25 spots left" / "Fully booked".
 *  Never yields "NaN" — guards missing capacity. Reads as registrations, not "joined". */
export function formatSpots(registered: number, capacity: number): string {
  if (!capacity || capacity <= 0) return "Registration open";
  const left = Math.max(0, capacity - registered);
  if (left === 0) return "Fully booked";
  const spots = `${left} ${left === 1 ? "spot" : "spots"} left`;
  return registered > 0 ? `${registered} registered · ${spots}` : spots;
}

/** Time-of-day like "6:30 PM", or null when the timestamp is midnight (i.e. a date-only value). */
export function formatTimeOfDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

/** True when an ISO timestamp falls on the same local calendar day as `now`. */
export function isToday(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
}

/** Date only: "Jul 17, 2026" (no time) — for deadlines and date-only fields. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** Coach session price: "₹300–500/session", "₹300/session", or "On request" when unpriced. */
export function formatSessionRange(minPaise: number | null, maxPaise: number | null): string {
  if (minPaise == null || minPaise === 0 || !Number.isFinite(minPaise)) return "On request";
  const min = Math.round(minPaise / 100);
  const max = maxPaise && maxPaise > minPaise ? Math.round(maxPaise / 100) : null;
  return max ? `₹${min}–${max}/session` : `₹${min}/session`;
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Detail "When" row: "Today · 7:30 PM · 90 min" (day · time · duration). Duration omitted if absent. */
export function formatSessionWhen(iso: string, durationMin?: number | null, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = sameDay
    ? "Today"
    : d.toDateString() === tomorrow.toDateString()
      ? "Tomorrow"
      : `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
  return [day, time, durationMin ? `${durationMin} min` : null].filter(Boolean).join(" · ");
}

/** Relative past time for feeds: "just now", "5 mins ago", "3 hours ago", "2 days ago", "1 week ago". */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (s < 45) return "just now";
  if (s < 3600) return ago(Math.round(s / 60), "min");
  if (s < 86400) return ago(Math.round(s / 3600), "hour");
  const days = Math.round(s / 86400);
  if (days < 7) return ago(days, "day");
  if (days < 30) return ago(Math.round(days / 7), "week");
  if (days < 365) return ago(Math.round(days / 30), "month");
  return ago(Math.round(days / 365), "year");
}

/** Calendar-badge parts for a detail hero: { month: "JUL", day: "05" }. null for invalid dates. */
export function dateBadge(iso: string): { month: string; day: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { month: MON[d.getMonth()].toUpperCase(), day: String(d.getDate()).padStart(2, "0") };
}

/** "Today 7:00 PM" / "Sat 20 Jul · 6:30 PM" — kit meta-row style. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} · ${time}`;
}

/**
 * Display label for a sport value coming from the server, whose casing is inconsistent
 * ("Badminton", "BOXING/KICK", "Table Tennis"). Title-cases each word so filter chips read as one
 * family. Shared by the games and coaches tabs, which both derive their chips from live data.
 */
export function prettySport(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
