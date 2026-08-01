/**
 * WhatsApp normalization parity (audit #25).
 *
 * These cases are lifted from the server's `GG/src/lib/whatsapp.ts` rules. If this drifts, the
 * create-game pre-check waves a host through four steps and the server rejects them at submit —
 * so parity IS the feature, not an implementation detail.
 */
import { hasWhatsAppNumber, toWhatsAppNumber } from "@/lib/phone";

describe("toWhatsAppNumber", () => {
  it("prepends the country code to a bare 10-digit Indian mobile", () => {
    expect(toWhatsAppNumber("9876543210")).toBe("919876543210");
  });

  it("strips spaces, plus and dashes from an already-international number", () => {
    expect(toWhatsAppNumber("+91 98765 43210")).toBe("919876543210");
    expect(toWhatsAppNumber("+91-98765-43210")).toBe("919876543210");
  });

  it("drops leading zeros before deciding the length", () => {
    // The old local copy in api/coaches.ts kept these, yielding a dead wa.me link.
    expect(toWhatsAppNumber("09876543210")).toBe("919876543210");
  });

  it("rejects input too short to be a real number", () => {
    expect(toWhatsAppNumber("123")).toBeNull();
    expect(toWhatsAppNumber("0")).toBeNull();
    expect(toWhatsAppNumber("98765")).toBeNull();
  });

  it("rejects empty and missing values", () => {
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber(undefined)).toBeNull();
  });

  it("rejects text with no usable digits", () => {
    expect(toWhatsAppNumber("call me")).toBeNull();
  });
});

describe("hasWhatsAppNumber — the create-game gate", () => {
  it("passes exactly what the server would accept", () => {
    expect(hasWhatsAppNumber("9876543210")).toBe(true);
    expect(hasWhatsAppNumber("+91 98765 43210")).toBe(true);
  });

  it("blocks what the server would reject, so the stepper never opens in vain", () => {
    expect(hasWhatsAppNumber(null)).toBe(false);
    expect(hasWhatsAppNumber("")).toBe(false);
    expect(hasWhatsAppNumber("123")).toBe(false);
  });
});
