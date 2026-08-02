/**
 * Regression guard for the 2 Aug 2026 report: four workshops that ended in July were still listed
 * in Discover. Root cause was server-side (the completion cron never covered workshops), but the
 * app rendered whatever the endpoint returned, so a server bug became a user-visible one. These
 * cover the client-side backstop.
 */
import {
  hasEnded,
  registrationClosed,
  startsBeyondWindow,
  toSummaryList,
  type RawRegisterable,
} from "@/api/registerable";
import { dropEnded, search } from "@/api/search";

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

describe("search: ended hits", () => {
  test("drops ended camp/event hits, keeps in-progress, future, and dateless ones", () => {
    const hits = [
      { id: "ended", title: "Football Academy", subtitle: null, endDate: "2026-07-05T00:00:00.000Z" },
      { id: "ongoing", title: "Kids Camp", subtitle: null, endDate: "2026-08-03T00:00:00.000Z" },
      { id: "future", title: "Swim Clinic", subtitle: null, endDate: "2026-09-01T00:00:00.000Z" },
      // Games and coaches carry no endDate — they must pass through untouched.
      { id: "game", title: "Evening Football", subtitle: null },
      { id: "garbage", title: "Odd row", subtitle: null, endDate: "not-a-date" },
    ];

    expect(dropEnded(hits, NOW).map((h) => h.id)).toEqual([
      "ongoing",
      "future",
      "game",
      "garbage",
    ]);
  });
});

/**
 * The helper tests above pass even if `search()` forgets to call the filter — so this one exercises
 * the wired path end to end. Found by mutation-testing: removing the call from search() left every
 * other test green.
 */
describe("search() applies the filter", () => {
  const fetchMock = jest.fn();
  const realFetch = globalThis.fetch;

  beforeAll(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  test("ended camps and events never reach the caller", async () => {
    const clock = jest.spyOn(Date, "now").mockReturnValue(NOW);
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        ok: true,
        data: {
          games: [{ id: "g1", title: "Football", subtitle: null }],
          coaches: [{ id: "c1", title: "Vijayan", subtitle: null }],
          camps: [
            { id: "camp-ended", title: "Old", subtitle: null, endDate: "2026-07-05T00:00:00.000Z" },
            { id: "camp-live", title: "Kids", subtitle: null, endDate: "2026-08-03T00:00:00.000Z" },
          ],
          events: [
            { id: "ev-ended", title: "Gone", subtitle: null, endDate: "2026-06-01T00:00:00.000Z" },
          ],
        },
      }),
    });

    try {
      const r = await search("foot");
      expect(r.camps.map((h) => h.id)).toEqual(["camp-live"]);
      expect(r.events).toEqual([]);
      // Untouched groups still pass through.
      expect(r.games).toHaveLength(1);
      expect(r.coaches).toHaveLength(1);
    } finally {
      clock.mockRestore();
    }
  });
});

describe("registration closed", () => {
  test("flags an item whose deadline has passed, without hiding it", () => {
    const camp = row({
      startDate: "2026-07-20",
      endDate: "2026-08-03",
      registrationDeadline: "2026-07-17",
    });

    expect(registrationClosed(camp, NOW)).toBe(true);
    // Still listed: Discover is the only surface for these, so hiding it would strand anyone
    // already registered. The card and the detail CTA say "Registration closed" instead.
    expect(hasEnded(camp, NOW)).toBe(false);
  });

  test("an open deadline, or none at all, is not closed", () => {
    expect(registrationClosed(row({ registrationDeadline: "2026-09-01" }), NOW)).toBe(false);
    expect(registrationClosed(row({}), NOW)).toBe(false);
    expect(registrationClosed(row({ registrationDeadline: "nonsense" }), NOW)).toBe(false);
  });
});

describe("one-month Discover window", () => {
  test("hides items starting further out than the window", () => {
    expect(startsBeyondWindow(row({ startDate: "2026-08-20" }), NOW)).toBe(false); // ~3 weeks
    expect(startsBeyondWindow(row({ startDate: "2026-09-20" }), NOW)).toBe(true); // ~7 weeks
  });

  test("an already-started item is inside the window, not beyond it", () => {
    expect(startsBeyondWindow(row({ startDate: "2026-07-20" }), NOW)).toBe(false);
  });

  test("the list mapper applies both the window and the ended filter", () => {
    const rows = [
      row({ id: "ended", startDate: "2026-07-05", endDate: "2026-07-05" }),
      row({ id: "closed-but-running", startDate: "2026-07-20", endDate: "2026-08-03", registrationDeadline: "2026-07-17" }),
      row({ id: "soon", startDate: "2026-08-10", endDate: "2026-08-11" }),
      row({ id: "far-off", startDate: "2026-11-01", endDate: "2026-11-02" }),
    ];

    const spy = jest.spyOn(Date, "now").mockReturnValue(NOW);
    try {
      const out = toSummaryList(rows, "camp");
      expect(out.map((s) => s.id)).toEqual(["closed-but-running", "soon"]);
      expect(out.find((s) => s.id === "closed-but-running")?.registrationClosed).toBe(true);
      expect(out.find((s) => s.id === "soon")?.registrationClosed).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("inclusive end date", () => {
  // endDate is date-only midnight UTC and means "runs through that day". Without grace, a camp
  // ending 3 Aug disappears at 05:30 IST on 3 Aug — during its own final day.
  const onFinalDay = new Date("2026-08-03T09:00:00.000Z").getTime(); // 14:30 IST, 3 Aug

  test("an item is still listed during its final day", () => {
    expect(hasEnded(row({ startDate: "2026-07-20", endDate: "2026-08-03" }), onFinalDay)).toBe(false);
  });

  test("and is gone the day after", () => {
    const nextDay = new Date("2026-08-04T09:00:00.000Z").getTime();
    expect(hasEnded(row({ startDate: "2026-07-20", endDate: "2026-08-03" }), nextDay)).toBe(true);
  });
});
