/**
 * Regression guard for the 5 Aug 2026 report: the create-game venue step listed every venue in the
 * system, so hosting badminton offered football turfs, and none of them showed how many slots were
 * open.
 *
 * The cause was one missing query param. `GET /venues` unfiltered returns all ACTIVE venues (11 in
 * production); the web create flow has always sent `?sport=`, and the server filters on
 * `supportedSports` and returns an `openSlots` count per venue. The app called the bare path and
 * dropped both fields on the floor while mapping.
 *
 * These cover the request shape, the client-side backstop, and the absent-vs-zero distinction on
 * `openSlots` — a count the UI renders, so "the server didn't say" must not read as "no slots".
 */
import { list } from "@/api/venues";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", googleIosClientId: "", googleAndroidClientId: "", posthogKey: "", sentryDsn: null },
}));

// `mock`-prefixed because jest hoists the factory above this declaration and refuses to let it
// close over anything else.
const mockGet = jest.fn();
jest.mock("@/api/client", () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }));

/** Shaped like the live payload: `{ ok, data: [...] }` with the server's own field names. */
const payload = (rows: Record<string, unknown>[]) => ({ ok: true, data: rows });

const venue = (name: string, supportedSports: string[], openSlots?: number) => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  address: `${name}, Kozhikode`,
  supportedSports,
  ...(openSlots === undefined ? {} : { openSlots }),
});

beforeEach(() => mockGet.mockReset());

test("the sport is sent to the server, URL-encoded", async () => {
  mockGet.mockResolvedValue(payload([]));
  await list("Table Tennis");
  expect(mockGet).toHaveBeenCalledWith("/venues?sport=Table%20Tennis");
});

test("no sport means the unfiltered path — for callers that genuinely want every venue", async () => {
  mockGet.mockResolvedValue(payload([]));
  await list();
  expect(mockGet).toHaveBeenCalledWith("/venues");
});

test("a venue that does not support the sport is dropped even if the server sends it", async () => {
  // The backstop that matters: this list is cached 5 minutes client-side and 60s at the edge, so a
  // pre-filter response can still be in hand when the picker renders.
  mockGet.mockResolvedValue(
    payload([
      venue("Mannil Vijayan Badminton House", ["Badminton"], 3),
      venue("Forza Turf Football", ["Football"], 16),
      venue("Calicut Arena", ["Basketball", "Badminton", "Volleyball"], 0),
    ]),
  );

  const result = await list("Badminton");

  expect(result.map((v) => v.name)).toEqual(["Mannil Vijayan Badminton House", "Calicut Arena"]);
});

test("a venue that declares no sports is KEPT — unknown is not the same as wrong", async () => {
  // Dropping these would empty the picker the day the server renames the field, which is a worse
  // failure than showing one venue too many.
  mockGet.mockResolvedValue(payload([{ id: "v1", name: "Unlabelled Court", address: "Kozhikode" }]));

  const result = await list("Badminton");

  expect(result.map((v) => v.name)).toEqual(["Unlabelled Court"]);
  expect(result[0].supportedSports).toEqual([]);
});

test("openSlots is carried through, and absent is null rather than zero", async () => {
  mockGet.mockResolvedValue(
    payload([venue("Has Openings", ["Badminton"], 3), venue("Silent On Slots", ["Badminton"])]),
  );

  const [withCount, without] = await list("Badminton");

  expect(withCount.openSlots).toBe(3);
  // Not 0: the UI shows "No open slots yet" for 0 and nothing at all for null.
  expect(without.openSlots).toBeNull();
});

test("a zero count is preserved as zero, not lost to the null fallback", async () => {
  mockGet.mockResolvedValue(payload([venue("Fully Booked", ["Badminton"], 0)]));

  const [only] = await list("Badminton");

  expect(only.openSlots).toBe(0);
});
