/**
 * Host-direct payment rules, mirrored from the server's `GG/src/lib/hostPayment.ts`.
 *
 * Player-hosted games are paid host-to-player, outside Game Ground: no order is created, no money
 * is held, nothing is refunded or settled by us. The app never computes the fee — it only has to
 * *collect* the host's terms at create time and hand them to the server verbatim.
 *
 * Why a mirror rather than a server fetch: these are the shapes of a Zod enum and a regex that the
 * server applies at `POST /games`. They have to be known *before* the request to keep an invalid
 * form from being submittable at all, and a create-game screen cannot wait on a round-trip to
 * learn that "upi" is a legal method. The server remains authoritative — it re-validates every
 * field and is the only thing that can reject — so a drift here costs a 422, not bad data.
 *
 * Pure module: no I/O, no React. Keep it that way so the form, the schema slice and any future
 * host-facing screen all read the same rules from one place, exactly as the server's copy does.
 */

/** The server's `HOST_PAYMENT_METHODS` Zod enum, in the order the picker renders them. */
export const HOST_PAYMENT_METHODS = ["upi", "cash", "upi_cash"] as const;
export type HostPaymentMethod = (typeof HOST_PAYMENT_METHODS)[number];

export const HOST_PAYMENT_METHOD_LABELS: Record<HostPaymentMethod, string> = {
  upi: "UPI",
  cash: "Cash",
  upi_cash: "UPI + Cash",
};

/**
 * The platform's legal position on player-hosted fees. Duplicated from the server so the create
 * form can show a host what players will be told *before* they commit to it; on the read side
 * `api/games.ts` still prefers the served string and only falls back to this one.
 */
export const HOST_PAYMENT_DISCLAIMER =
  "Game Ground does not process payments for player-hosted games.";

/**
 * The SECOND disclaimer, for the host→venue leg.
 *
 * A distinct transaction from the one above and therefore a distinct position: `hostPayment()`
 * covers player→host, this covers a host who collects on a venue's behalf and then owes that
 * venue. The server does NOT send it — unlike `disclaimer`, it is a client constant on the web
 * too — so it can only appear here by being rendered wherever `venueNote` is.
 *
 * Never render a `venueNote` without it. The note is the host's claim that money is passing
 * through them to somebody else, and that is exactly the arrangement a player might otherwise
 * read as Game Ground standing behind the venue booking.
 */
export const VENUE_PAYMENT_DISCLAIMER =
  "The host is responsible for paying the venue/organization. Game Ground is not involved in this transaction.";

export function isHostPaymentMethod(v: unknown): v is HostPaymentMethod {
  return typeof v === "string" && (HOST_PAYMENT_METHODS as readonly string[]).includes(v);
}

/**
 * UPI details are only meaningful for methods that actually accept UPI. The server drops a stale
 * `hostUpiId` when the method is cash-only, so sending one is not harmful — but collecting one
 * behind a Cash chip would be asking the host for something we know will be thrown away.
 */
export function acceptsUpi(method: string | null | undefined): boolean {
  return method === "upi" || method === "upi_cash";
}

/**
 * `handle@psp`. Deliberately permissive on the handle (banks allow dots, hyphens and underscores)
 * and strict only about the shape — copied character-for-character from the server's `UPI_ID`,
 * because rejecting a valid id is worse than accepting a typo the host can see and fix.
 */
const UPI_ID = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;

export function isValidUpiId(v: string): boolean {
  return UPI_ID.test(v.trim());
}

/**
 * Can a host be paid at all with what they've entered?
 *
 * A UPI-accepting game needs a usable id **or** a QR: without either, the game page tells a player
 * to pay the host by UPI and then shows them no way to do it. Cash-only games need neither. This
 * is deliberately STRICTER than the server, which accepts a paid game with both fields null (that
 * leniency exists for games created before the picker did) — the web form applies the same extra
 * rule at the same point, so the two clients stay consistent about what they'll let a host create.
 */
export function canCollect(
  method: string | null | undefined,
  upiId: string,
  qrUrl: string,
): boolean {
  if (!acceptsUpi(method)) return true;
  return (upiId.trim() !== "" && isValidUpiId(upiId)) || qrUrl.trim() !== "";
}
