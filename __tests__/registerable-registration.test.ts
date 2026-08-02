/**
 * Registerable registration paths (audit #28, #29, #30).
 *
 * The key rule these lock in: a FREE camp/workshop/event has its own endpoint and can never go
 * through checkout. The server's charge helpers throw NotPayableError on a ₹0 amount, so the
 * gateway is unreachable by design — treating free as "checkout with amount 0" silently breaks it.
 */
import * as campsApi from "@/api/camps";
import * as eventsApi from "@/api/events";
import * as workshopsApi from "@/api/workshops";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", googleIosClientId: "", googleAndroidClientId: "", posthogKey: "", sentryDsn: null },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0" } },
}));

jest.mock("@/lib/storage", () => ({
  get: jest.fn(async () => null),
  set: jest.fn(async () => {}),
  remove: jest.fn(async () => {}),
  clearAuth: jest.fn(async () => {}),
  deviceId: jest.fn(async () => "device-1"),
}));

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function mockOnce(payload: unknown) {
  fetchMock.mockResolvedValue({
    status: 200,
    headers: { get: () => null },
    json: async () => ({ ok: true, data: payload }),
  });
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  const i = init as { method: string; body?: string };
  return { url: String(url), method: i.method, body: i.body ? JSON.parse(i.body) : undefined };
}

beforeEach(() => fetchMock.mockReset());

describe("free registration", () => {
  it("camps POST the entity route with the registration fields", async () => {
    mockOnce({ registered: true, slotsLeft: 79 });
    await campsApi.register("camp-1", { childName: "Ada", childAge: 9 });
    const { url, method, body } = lastCall();
    expect(method).toBe("POST");
    expect(url).toContain("/camps/camp-1");
    expect(body).toEqual({ childName: "Ada", childAge: 9 });
  });

  it("workshops and events use their own routes", async () => {
    mockOnce({ registered: true });
    await workshopsApi.register("w-1", { participantName: "Ada", registrationType: "Individual" });
    expect(lastCall().url).toContain("/workshops/w-1");

    mockOnce({ registered: true });
    await eventsApi.register("e-1", { teamName: "Rovers" });
    expect(lastCall().url).toContain("/events/e-1");
  });
});

describe("cancel registration", () => {
  it("uses DELETE on the entity route", async () => {
    mockOnce({ cancelled: true });
    await campsApi.cancel("camp-1");
    const { url, method } = lastCall();
    expect(method).toBe("DELETE");
    expect(url).toContain("/camps/camp-1");
  });
});

describe("viewer registration mapping", () => {
  const base = {
    id: "camp-1",
    title: "Kids Camp",
    price: 0,
    participants: 4,
    maxParticipants: 80,
  };

  it("prefers the derived registeredCount over the participants counter", async () => {
    mockOnce({ ...base, participants: 4, registeredCount: 7 });
    const d = await campsApi.detail("camp-1");
    expect(d.registered).toBe(7);
  });

  it("falls back to participants when registeredCount is absent (list shape)", async () => {
    mockOnce({ ...base, participants: 4 });
    const d = await campsApi.detail("camp-1");
    expect(d.registered).toBe(4);
  });

  it("maps the viewer's registration so they aren't asked to pay twice", async () => {
    mockOnce({ ...base, userRegistration: { id: "reg-1", paymentStatus: "paid" } });
    const d = await campsApi.detail("camp-1");
    expect(d.viewerRegistration).toMatchObject({ id: "reg-1", paymentStatus: "paid" });
  });

  it("is null for a signed-out or unregistered viewer", async () => {
    mockOnce({ ...base, userRegistration: null });
    expect((await campsApi.detail("camp-1")).viewerRegistration).toBeNull();
  });

  it("carries an event's pending/rejected status — paid does not mean confirmed", async () => {
    mockOnce({
      ...base,
      userRegistration: {
        id: "reg-2",
        paymentStatus: "paid",
        status: "rejected",
        rejectionReason: "Team roster incomplete",
      },
    });
    const d = await eventsApi.detail("e-1");
    expect(d.viewerRegistration?.status).toBe("rejected");
    expect(d.viewerRegistration?.rejectionReason).toBe("Team roster incomplete");
  });
});
