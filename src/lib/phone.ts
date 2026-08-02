/**
 * WhatsApp number normalization — a direct mirror of the server's `src/lib/whatsapp.ts`.
 *
 * This has to match exactly, because the server gates game creation on it: `POST /games` rejects
 * with 400 "Add a WhatsApp number to your profile before hosting a game." when
 * `toWhatsAppNumber(user.phone)` is null. A looser client check (e.g. `!!phone`) would wave a host
 * through four steps of the stepper and then fail at submit.
 *
 * User.phone is free text, so stored values vary: "+91 98765 43210", "09876543210", "9876543210".
 */

const IN_COUNTRY_CODE = "91";

/**
 * Free-text phone → wa.me digits, or null when it can't become a usable number.
 * Strip non-digits, drop leading zeros, prepend 91 to a bare 10-digit Indian mobile.
 * Valid = country code + at least a 10-digit subscriber number.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10) digits = IN_COUNTRY_CODE + digits;
  return digits.length >= 11 ? digits : null;
}

/** True when this phone would satisfy the server's host-reachability check. */
export function hasWhatsAppNumber(phone: string | null | undefined): boolean {
  return toWhatsAppNumber(phone) !== null;
}
