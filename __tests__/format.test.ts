/** M5 — presentation formatters. The app renders server paise; it never computes money. */
import { formatAmount, formatPrice, formatWhen, prettySport } from "@/lib/format";

describe("formatPrice", () => {
  test("null and zero render as FREE (caller shows the label)", () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(0)).toBeNull();
  });
  test("absent/non-finite paise → null, never '₹NaN'", () => {
    expect(formatPrice(undefined)).toBeNull();
    expect(formatPrice(NaN)).toBeNull();
    expect(formatPrice(Infinity)).toBeNull();
  });
  test("whole rupees drop the decimals", () => {
    expect(formatPrice(12000)).toBe("₹120");
  });
  test("fractional paise keep two decimals", () => {
    expect(formatPrice(12050)).toBe("₹120.50");
  });
});

test("formatAmount always shows a value with thousands separators", () => {
  expect(formatAmount(250000)).toBe("₹2,500");
});

describe("formatWhen", () => {
  const now = new Date("2026-07-26T10:00:00");
  test("same day → Today + time", () => {
    expect(formatWhen("2026-07-26T19:00:00", now)).toBe("Today 7:00 PM");
  });
  test("next day → Tomorrow + time", () => {
    expect(formatWhen("2026-07-27T18:30:00", now)).toBe("Tomorrow 6:30 PM");
  });
  test("further out → weekday + date", () => {
    expect(formatWhen("2026-08-01T18:30:00", now)).toMatch(/Sat 1 Aug · 6:30 PM/);
  });
  test("garbage in → empty string, never a crash", () => {
    expect(formatWhen("not-a-date", now)).toBe("");
  });
});

describe("prettySport", () => {
  test("normalises the server's inconsistent casing", () => {
    expect(prettySport("BOXING/KICK")).toBe("Boxing/Kick");
    expect(prettySport("table tennis")).toBe("Table Tennis");
    expect(prettySport("Badminton")).toBe("Badminton");
  });

  test("chips sort by label, so case never reorders them", () => {
    // Raw .sort() puts "BOXING/KICK" first because uppercase sorts before lowercase in ASCII.
    const raw = ["BOXING/KICK", "Badminton", "Calisthenics", "Table Tennis"];
    const labels = raw.map(prettySport).sort((a, b) => a.localeCompare(b));
    expect(labels).toEqual(["Badminton", "Boxing/Kick", "Calisthenics", "Table Tennis"]);
  });
});
