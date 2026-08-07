/**
 * Sign in with Apple client contract (Decision 29).
 *
 * Pins the two things about this flow that are easy to get wrong and impossible to notice later:
 *
 *  1. **The name is forwarded.** Apple releases the user's full name on the FIRST authorization
 *     only, and only to the client — it is never inside the identity token. If the client drops it,
 *     the account is stuck with whatever placeholder the server invents, permanently, and no
 *     re-login can recover it because Apple never sends it again.
 *  2. **A 401 here is a verdict, not an expired session.** Like every other credential endpoint it
 *     must not refresh-and-replay (see `skipSessionRefresh` in api/client.ts).
 */
import * as authApi from "@/api/auth";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "test", apiUrl: "https://api.test", sentryDsn: null },
}));

const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
}));

const mockSetItem = jest.fn();
jest.mock("@/lib/storage", () => ({
  get: jest.fn(async () => null),
  set: jest.fn(async (k: string, v: unknown) => mockSetItem(k, v)),
  remove: jest.fn(async () => undefined),
  clearAuth: jest.fn(async () => undefined),
  deviceId: jest.fn(async () => "device-1"),
}));

const PAYLOAD = {
  user: { id: "u1", email: "a@privaterelay.appleid.com", name: "Ana", username: "ana", role: "player" },
  token: "tok-1",
};

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue(PAYLOAD);
  mockSetItem.mockReset();
});

test("posts the identity token and the name to the native Apple route", async () => {
  await authApi.loginWithApple("identity-token-abc", "Ana Nair");

  const [path, body] = mockPost.mock.calls[0];
  expect(path).toBe("/auth/apple/mobile");
  expect(body).toEqual({ identityToken: "identity-token-abc", fullName: "Ana Nair" });
});

test("a later sign-in sends fullName: null, which is expected rather than an error", async () => {
  // Apple omits the name on every authorization after the first. The server already has it.
  await expect(authApi.loginWithApple("identity-token-abc", null)).resolves.toEqual(PAYLOAD);

  expect(mockPost.mock.calls[0][1]).toEqual({ identityToken: "identity-token-abc", fullName: null });
});

test("the 401 on this route is a credential verdict — no refresh-and-replay", async () => {
  await authApi.loginWithApple("identity-token-abc", null);

  // Third argument is the request options; it must opt out of the session refresh, exactly as
  // login/register/google-exchange do.
  expect(mockPost.mock.calls[0][2]).toEqual({ skipSessionRefresh: true });
});

test("a successful sign-in persists the session like any other auth path", async () => {
  await authApi.loginWithApple("identity-token-abc", "Ana Nair");

  expect(mockSetItem).toHaveBeenCalledWith("gg.access", "tok-1");
  expect(mockSetItem).toHaveBeenCalledWith("gg.user", PAYLOAD.user);
});

test("no refresh token in the response is tolerated, not fatal", async () => {
  // The server's apple route returns { user, token } only — there is no refresh layer yet
  // (see the website hand-off, A4). Persisting must not assume one.
  await expect(authApi.loginWithApple("t", null)).resolves.toBeDefined();
  expect(mockSetItem).not.toHaveBeenCalledWith("gg.refresh", expect.anything());
});
