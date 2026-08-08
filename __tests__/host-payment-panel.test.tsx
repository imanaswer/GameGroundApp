/**
 * HostPaymentPanel invariants (DESIGN_SYSTEM §9A).
 *
 * These are not render-smoke tests. Each one pins a rule whose violation costs a player money or
 * misstates Game Ground's legal position, which is why they are asserted rather than eyeballed in
 * the catalog.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";

import type { HostPayment } from "@/api/types";
import { HostPaymentPanel } from "@/components/checkout";
import { VENUE_PAYMENT_DISCLAIMER } from "@/lib/hostPayment";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", posthogKey: "", sentryDsn: null },
}));

// `ds/icons.tsx` pulls in @expo/vector-icons, whose Feather entry point does not resolve under
// jest-expo. This is the first test in the repo to render a DS component, so the stub lands here;
// move it to a setup file if a second suite needs it.
jest.mock("@expo/vector-icons/Feather", () => "Feather");

// `mock`-prefixed because jest hoists the factory above this declaration and only allows
// out-of-scope names matching that convention.
const mockSetStringAsync = jest.fn().mockResolvedValue(true);
jest.mock("expo-clipboard", () => ({ setStringAsync: (v: string) => mockSetStringAsync(v) }));
// Every export stubbed, not just the ones this component calls: `Press` and `Button` fire their
// own haptics, and a partial mock fails as "buttonPress is not a function" from inside the DS.
jest.mock("@/lib/haptics", () => ({
  selection: jest.fn(),
  buttonPress: jest.fn(),
  success: jest.fn(),
  paymentSuccess: jest.fn(),
  tierUp: jest.fn(),
  warning: jest.fn(),
  destructive: jest.fn(),
  refresh: jest.fn(),
}));

const DISCLAIMER = "Game Ground does not process payments for player-hosted games.";

const base: HostPayment = {
  amount: 120,
  currency: "INR",
  method: "upi_cash",
  methodLabel: "UPI + Cash",
  upiId: "host@okhdfcbank",
  qrUrl: "https://cdn.test/qr.png",
  instructions: null,
  venueNote: null,
  disclaimer: DISCLAIMER,
};

beforeEach(() => mockSetStringAsync.mockClear());

describe("the disclaimer is inseparable from the amount", () => {
  test.each(["upi", "cash", "upi_cash"] as const)("renders in the %s state", (method) => {
    render(<HostPaymentPanel payment={{ ...base, method }} myStatus="pending" />);
    expect(screen.getByText(DISCLAIMER)).toBeTruthy();
  });

  test("renders even when the host supplied no details at all", () => {
    render(
      <HostPaymentPanel
        payment={{ ...base, upiId: null, qrUrl: null, instructions: null, venueNote: null }}
        myStatus="pending"
      />,
    );
    expect(screen.getByText(DISCLAIMER)).toBeTruthy();
    expect(screen.getByText("₹120")).toBeTruthy();
  });
});

/**
 * The host→venue leg is a SECOND legal position, covering a different transaction from the
 * player→host one above. The web renders it under every venue note; the app shipped the note
 * without it, which reads as Game Ground standing behind the venue booking.
 */
describe("a venue note never appears without its own disclaimer", () => {
  const withVenue = { ...base, venueNote: "Host collects the fee and pays the turf." };

  test("both the note and the venue disclaimer render", () => {
    render(<HostPaymentPanel payment={withVenue} myStatus="pending" />);
    expect(screen.getByText("Host collects the fee and pays the turf.")).toBeTruthy();
    expect(screen.getByText(VENUE_PAYMENT_DISCLAIMER)).toBeTruthy();
  });

  test("the player→host disclaimer is still there too — one does not replace the other", () => {
    render(<HostPaymentPanel payment={withVenue} myStatus="pending" />);
    expect(screen.getByText(DISCLAIMER)).toBeTruthy();
    expect(screen.getByText(VENUE_PAYMENT_DISCLAIMER)).toBeTruthy();
  });

  test("no venue note means no venue disclaimer — it is not boilerplate", () => {
    render(<HostPaymentPanel payment={base} myStatus="pending" />);
    expect(screen.queryByText(VENUE_PAYMENT_DISCLAIMER)).toBeNull();
  });
});

describe("the QR stays behind a disclosure (§9A option (a))", () => {
  test("is not rendered until asked for, so the disclaimer keeps the fold", () => {
    render(<HostPaymentPanel payment={base} myStatus="pending" />);
    expect(screen.queryByLabelText("Host's UPI QR code")).toBeNull();
    fireEvent.press(screen.getByText("Show QR"));
    expect(screen.getByLabelText("Host's UPI QR code")).toBeTruthy();
  });

  test("no disclosure at all when the host set no QR", () => {
    render(<HostPaymentPanel payment={{ ...base, qrUrl: null }} myStatus="pending" />);
    expect(screen.queryByText("Show QR")).toBeNull();
  });
});

describe("a credential is complete or absent", () => {
  test("no UPI row when the host never set an id — nothing to copy by mistake", () => {
    render(<HostPaymentPanel payment={{ ...base, upiId: null }} myStatus="pending" />);
    expect(screen.queryByText("UPI ID")).toBeNull();
  });

  test("cash-only never offers a UPI id, even if one is somehow on the payload", () => {
    render(<HostPaymentPanel payment={{ ...base, method: "cash" }} myStatus="pending" />);
    expect(screen.queryByText("UPI ID")).toBeNull();
  });

  test("copying puts the id itself on the clipboard, not the label", () => {
    const onCopied = jest.fn();
    render(<HostPaymentPanel payment={base} myStatus="pending" onCopied={onCopied} />);
    fireEvent.press(screen.getByText("host@okhdfcbank"));
    expect(mockSetStringAsync).toHaveBeenCalledWith("host@okhdfcbank");
  });
});

describe("settle-up is a claim, and only the right person makes it", () => {
  test("a joined player can mark themselves", () => {
    const onMarkPaid = jest.fn();
    render(<HostPaymentPanel payment={base} myStatus="pending" onMarkPaid={onMarkPaid} />);
    fireEvent.press(screen.getByText("I’ve paid the host"));
    expect(onMarkPaid).toHaveBeenCalledWith("paid");
  });

  test("the host gets no self-mark button — they mark the roster instead", () => {
    render(<HostPaymentPanel payment={base} myStatus={null} canMarkOthers />);
    expect(screen.queryByText("I’ve paid the host")).toBeNull();
  });

  test("a viewer who has not joined is not asked to settle up", () => {
    render(<HostPaymentPanel payment={base} myStatus={null} />);
    expect(screen.queryByText("I’ve paid the host")).toBeNull();
  });

  test("once paid the button is gone and the copy refuses to call it a receipt", () => {
    render(<HostPaymentPanel payment={base} myStatus="paid" />);
    expect(screen.queryByText("I’ve paid the host")).toBeNull();
    expect(screen.getByText("Marked as paid")).toBeTruthy();
    expect(screen.getByText(/doesn’t verify payments/)).toBeTruthy();
  });
});

/**
 * The server's `feeLabel` rule: "reads per player, never as a total". A bare figure above a
 * 10-slot game invites the opposite reading — the pot to split rather than each person's share.
 */
describe("the fee is qualified as per-player", () => {
  test.each(["upi", "cash", "upi_cash"] as const)("in the %s state", (method) => {
    render(<HostPaymentPanel payment={{ ...base, method }} myStatus="pending" />);
    expect(screen.getByText("per player")).toBeTruthy();
  });
});

describe("amount is rupees, not paise", () => {
  test("120 renders as ₹120 — formatAmount would have made it ₹1.20", () => {
    render(<HostPaymentPanel payment={base} myStatus="pending" />);
    expect(screen.getByText("₹120")).toBeTruthy();
  });

  test("a non-integer keeps two decimals", () => {
    render(<HostPaymentPanel payment={{ ...base, amount: 99.5 }} myStatus="pending" />);
    expect(screen.getByText("₹99.50")).toBeTruthy();
  });

  test("a non-INR currency is labelled rather than assumed", () => {
    render(<HostPaymentPanel payment={{ ...base, currency: "AED", amount: 40 }} myStatus="pending" />);
    expect(screen.getByText("AED 40")).toBeTruthy();
  });
});
