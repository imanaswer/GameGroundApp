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

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
