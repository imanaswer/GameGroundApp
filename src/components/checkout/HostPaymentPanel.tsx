/**
 * DESIGN_SYSTEM.md §9A — how a player-hosted game's fee gets settled.
 *
 * **This is not a checkout.** Game Ground creates no order for a player-hosted game, holds no
 * money, and can neither refund nor settle it — the host is paid directly by UPI or cash. The
 * panel's whole job is to hand over the host's details accurately and then get out of the way.
 *
 * Three rules the component enforces so screens can't get them wrong:
 *
 * 1. **The disclaimer cannot be separated from the amount.** It arrives as server data (it is a
 *    legal position, not app copy) and renders unconditionally beneath every state. This is why
 *    the QR sits behind a disclosure — see below.
 * 2. **A payment claim is never optimistic** (§6.1). "Mark as paid" waits for the server; it is a
 *    claim about money that already moved outside the app, and showing it as settled before the
 *    server agrees invents a record the host never confirmed.
 * 3. **A credential is either complete or absent.** `api/games.ts` already drops malformed blocks;
 *    here, a missing `upiId` renders no UPI row at all rather than an empty one to copy.
 *
 * **QR behind "Show QR" (approved §9A option (a)).** A legible QR is ≥160pt, which on a 375pt
 * screen pushes the disclaimer below the fold in the `upi_cash` state. The disclaimer is the part
 * that must never be missed; a player who wants the QR has already decided to pay and will happily
 * spend one tap on it.
 */
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Badge, Button, ChevronDownIcon, InfoIcon, Press } from "@/components/ds";
import type { HostPayment, HostPaymentStatus } from "@/api/types";
import * as haptics from "@/lib/haptics";
import { VENUE_PAYMENT_DISCLAIMER } from "@/lib/hostPayment";
import { color, radius, space, type } from "@/lib/tokens";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

/** Minimum size at which a payment QR reliably scans. Below this it is decoration. */
const QR_SIZE = 200;

export interface HostPaymentPanelProps {
  payment: HostPayment;
  /** The viewer's own settle-up state, or null when they haven't joined. */
  myStatus: HostPaymentStatus | null;
  /** True for the host, who marks other players rather than themselves. */
  canMarkOthers?: boolean;
  onMarkPaid?: (next: HostPaymentStatus) => void;
  busy?: boolean;
  /** Surfaces the copy confirmation. Screens own the toast; the panel owns the haptic. */
  onCopied?: (label: string) => void;
  testID?: string;
}

/**
 * Rupees, not paise — `HostPayment.amount` is the host's asking figure rather than a gateway
 * amount, so `formatAmount` (which expects paise) would be wrong by a factor of 100 here.
 */
function formatRupees(amount: number, currency: string): string {
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return currency === "INR" ? `₹${n}` : `${currency} ${n}`;
}

export function HostPaymentPanel({
  payment,
  myStatus,
  canMarkOthers = false,
  onMarkPaid,
  busy = false,
  onCopied,
  testID,
}: HostPaymentPanelProps) {
  const s = useThemedStyles(sheets);
  const palette = usePalette();
  const [qrOpen, setQrOpen] = useState(false);

  const showsUpi = payment.method === "upi" || payment.method === "upi_cash";
  const paid = myStatus === "paid";

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    haptics.selection();
    onCopied?.(label);
  };

  return (
    <View style={s.card} testID={testID}>
      {/* "per player" is not decoration — it is the server's `feeLabel` rule ("reads per player,
          never as a total") carried onto this surface. A bare "₹120" above a 10-slot game invites
          exactly the wrong reading: the pot to split rather than each person's share. */}
      <View style={s.amountRow}>
        <Text style={s.amount}>{formatRupees(payment.amount, payment.currency)}</Text>
        <Text style={s.perPlayer}>per player</Text>
        <Text style={s.method}>{payment.methodLabel}</Text>
      </View>

      <Text style={s.payTo}>Paid directly to the host</Text>

      {/* UPI credential. Absent for a cash-only game, and absent when the host never set one —
          an empty row invites a player to copy nothing and call it a payment. */}
      {showsUpi && payment.upiId && (
        <Press onPress={() => copy(payment.upiId!, "UPI ID")} style={s.credential}>
          <View style={s.credentialText}>
            <Text style={s.credentialLabel}>UPI ID</Text>
            {/* `selectable` as well as the tap target: the OS's own copy is muscle memory for
                some players, and it costs nothing to leave it working. */}
            <Text style={s.credentialValue} selectable numberOfLines={1}>
              {payment.upiId}
            </Text>
          </View>
          <Text style={s.copyHint}>Copy</Text>
        </Press>
      )}

      {showsUpi && payment.qrUrl && (
        <>
          <Press onPress={() => setQrOpen((v) => !v)} style={s.disclosure}>
            <Text style={s.disclosureLabel}>{qrOpen ? "Hide QR" : "Show QR"}</Text>
            <ChevronDownIcon size={14} color={palette.dim} />
          </Press>
          {qrOpen && (
            <View style={s.qrWrap}>
              {/* White plate under the code regardless of theme: a QR inverted by dark mode does
                  not scan, and the quiet zone is part of the symbol, not padding we may reclaim. */}
              <Image
                source={{ uri: payment.qrUrl }}
                style={s.qr}
                contentFit="contain"
                transition={120}
                accessibilityLabel="Host's UPI QR code"
              />
            </View>
          )}
        </>
      )}

      {payment.method === "cash" && <Text style={s.cashNote}>Pay the host in cash.</Text>}

      {!!payment.instructions && <Text style={s.instructions}>{payment.instructions}</Text>}

      {/* The venue note and ITS disclaimer are one unit, exactly as on the web. The note says
          money is passing through the host to somebody else; without the second disclaimer that
          reads as Game Ground standing behind the venue booking, which is the arrangement rule 1
          above exists to prevent. Unlike `payment.disclaimer` this one is not server-sent — it is
          a client constant on both platforms — so dropping it here is a silent divergence. */}
      {!!payment.venueNote && (
        <>
          <View style={s.venueNote}>
            <InfoIcon size={13} color={palette.dim2} />
            <Text style={s.venueNoteText}>{payment.venueNote}</Text>
          </View>
          <View style={s.disclaimer}>
            <Text style={s.disclaimerText}>{VENUE_PAYMENT_DISCLAIMER}</Text>
          </View>
        </>
      )}

      {/* Settle-up. Hidden from the host, who marks players on the roster instead — self-marking
          their own game is meaningless, and the server 403s a player marking anyone else. */}
      {!canMarkOthers && myStatus !== null && (
        <View style={s.settle}>
          {paid ? (
            <Badge tone="success" label="Marked as paid" />
          ) : (
            <Button
              variant="secondary"
              title="I’ve paid the host"
              onPress={() => onMarkPaid?.("paid")}
              loading={busy}
              disabled={busy}
            />
          )}
          <Text style={s.settleNote}>
            {paid
              ? "The host can see this. Game Ground doesn’t verify payments."
              : "This tells the host to look for your transfer. It isn’t a receipt."}
          </Text>
        </View>
      )}

      {/* Server-owned, unconditional, never truncated. See the header note. */}
      <View style={s.disclaimer}>
        <Text style={s.disclaimerText}>{payment.disclaimer}</Text>
      </View>
    </View>
  );
}

const sheets = themed(() => ({
  card: {
    backgroundColor: color.card,
    borderRadius: radius.card,
    padding: space(4.5),
    borderWidth: 1,
    borderColor: color.border,
  },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: space(2) },
  amount: { ...type.title2, color: color.text },
  // Sits with the figure it qualifies (baseline-aligned, `dim` not `dim2`) so it reads as part of
  // the price rather than as another piece of metadata beside the method label.
  perPlayer: { ...type.caption, color: color.dim, marginRight: "auto" },
  method: { ...type.caption, color: color.dim2 },
  payTo: { ...type.caption, color: color.dim, marginTop: space(0.5) },

  credential: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(3),
    marginTop: space(3.5),
    padding: space(3),
    borderRadius: radius.input,
    backgroundColor: color.elev,
  },
  credentialText: { flex: 1, gap: space(0.5) },
  credentialLabel: { ...type.micro, color: color.dim2 },
  credentialValue: { ...type.body, color: color.text },
  copyHint: { ...type.label, color: color.primary },

  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.5),
    marginTop: space(3),
    paddingVertical: space(1.5),
  },
  disclosureLabel: { ...type.label, color: color.dim },
  qrWrap: {
    alignSelf: "flex-start",
    marginTop: space(2),
    padding: space(3),
    borderRadius: radius.input,
    // The fixed light plate, not a themed surface: a QR inverted by dark mode does not scan.
    backgroundColor: color.shineWhite,
  },
  qr: { width: QR_SIZE, height: QR_SIZE },

  cashNote: { ...type.body, color: color.dim, marginTop: space(3) },
  instructions: { ...type.body, color: color.dim, marginTop: space(3) },

  venueNote: { flexDirection: "row", gap: space(1.5), alignItems: "flex-start", marginTop: space(2.5) },
  venueNoteText: { ...type.caption, color: color.dim2, flex: 1 },

  settle: { marginTop: space(4), gap: space(2), alignItems: "flex-start" },
  settleNote: { ...type.caption, color: color.dim2 },

  disclaimer: {
    marginTop: space(4),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  disclaimerText: { ...type.caption, color: color.dim2 },
}));
