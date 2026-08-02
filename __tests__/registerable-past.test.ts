/**
 * Regression guard for the 2 Aug 2026 report: four workshops that ended in July were still listed
 * in Discover. Root cause was server-side (the completion cron never covered workshops), but the
 * app rendered whatever the endpoint returned, so a server bug became a user-visible one. These
 * cover the client-side backstop.
 */
import { hasEnded, toSummaryList, type RawRegisterable } from "@/api/registerable";

// registerable imports the api client, which reads env at module load.
jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", googleIosClientId: "", googleAndroidClientId: "", posthogKey: "", sentryDsn: null },
}));

const NOW = new Date("2026-08-02T12:00:00.000Z").getTime();

const row = (over: Partial<RawRegisterable>): RawRegisterable => ({
  id: "x",
  title: "Thing",
  ...over,
});

describe("hasEnded", () => {
  test("an item whose end date has passed is over", () => {
    expect(hasEnded(row({ startDate: "2026-07-05", endDate: "2026-07-05" }), NOW)).toBe(true);
  });

  test("an in-progress item is NOT over — the filter is on end, not start", () => {
    // The camp that ran 20 Jul – 3 Aug was correctly visible on 2 Aug. A startDate-based filter
    // would have hidden it, which is the opposite bug.
    expect(hasEnded(row({ startDate: "2026-07-20", endDate: "2026-08-03" }), NOW)).toBe(false);
  });

  test("a future item is not over", () => {
    expect(hasEnded(row({ startDate: "2026-09-01", endDate: "2026-09-02" }), NOW)).toBe(false);
  });

  test("falls back to the start date when the server sends no end date", () => {
    expect(hasEnded(row({ startDate: "2026-07-05" }), NOW)).toBe(true);
    expect(hasEnded(row({ startDate: "2026-09-05" }), NOW)).toBe(false);
  });

  test("keeps anything with no usable date — hiding real content is the worse failure", () => {
    expect(hasEnded(row({}), NOW)).toBe(false);
    expect(hasEnded(row({ startDate: "not-a-date" }), NOW)).toBe(false);
  });
});

describe("toSummaryList", () => {
  test("drops ended rows and keeps the rest, preserving order", () => {
    const rows = [
      row({ id: "ended", title: "Football Academy", startDate: "2026-07-05", endDate: "2026-07-05" }),
      row({ id: "ongoing", title: "Kids Camp", startDate: "2026-07-20", endDate: "2026-08-03" }),
      row({ id: "future", title: "Swim Clinic", startDate: "2026-09-01", endDate: "2026-09-01" }),
    ];

    // Frozen clock: the filter uses Date.now(), and these fixtures are dated around 2 Aug 2026.
    const spy = jest.spyOn(Date, "now").mockReturnValue(NOW);
    try {
      expect(toSummaryList(rows, "workshop").map((s) => s.id)).toEqual(["ongoing", "future"]);
    } finally {
      spy.mockRestore();
    }
  });
});
