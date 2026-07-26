/**
 * M12/M13 — deep-link resolver. Notification data.url and web/scheme links map to app routes;
 * anything unmappable returns null so the caller can fall back to home (never a crash).
 */
import { planNavigation, resolveDeepLink } from "@/lib/deeplinks";

describe("resolveDeepLink", () => {
  test("web plural entity URLs map to singular app routes", () => {
    expect(resolveDeepLink("https://www.gameground.net/games/abc123")).toBe("/game/abc123");
    expect(resolveDeepLink("https://www.gameground.net/coaches/c1")).toBe("/coach/c1");
    expect(resolveDeepLink("https://www.gameground.net/camps/k1")).toBe("/camp/k1");
    expect(resolveDeepLink("https://www.gameground.net/workshops/w1")).toBe("/workshop/w1");
    expect(resolveDeepLink("https://www.gameground.net/events/e1")).toBe("/event/e1");
  });

  test("custom scheme links resolve the same way", () => {
    expect(resolveDeepLink("gameground://game/abc123")).toBe("/game/abc123");
    expect(resolveDeepLink("gameground://coach/c1")).toBe("/coach/c1");
  });

  test("player/user links go to the profile route with a query", () => {
    expect(resolveDeepLink("https://www.gameground.net/users/u1")).toBe("/profile?userId=u1");
  });

  test("static routes resolve without an id", () => {
    expect(resolveDeepLink("https://www.gameground.net/leaderboard")).toBe("/leaders");
    expect(resolveDeepLink("gameground://home")).toBe("/home");
  });

  test("unmappable / malformed links return null (caller falls back to home)", () => {
    expect(resolveDeepLink("https://www.gameground.net/admin/secret")).toBeNull();
    expect(resolveDeepLink("https://www.gameground.net/")).toBeNull();
    expect(resolveDeepLink("not a url")).toBeNull();
    expect(resolveDeepLink("")).toBeNull();
  });

  test("S1.9 — ids with injection/traversal chars are rejected, not interpolated", () => {
    expect(resolveDeepLink("https://www.gameground.net/games/../admin")).toBeNull();
    expect(resolveDeepLink("https://www.gameground.net/games/a b c")).toBeNull();
    expect(resolveDeepLink("gameground://game/<script>")).toBeNull();
  });
});

describe("planNavigation (auth-gated stash-and-resume)", () => {
  const link = "https://www.gameground.net/games/abc123";

  test("signed in → navigate straight to the target", () => {
    expect(planNavigation(link, true)).toEqual({ action: "navigate", path: "/game/abc123" });
  });

  test("signed out → stash the target and go to login", () => {
    expect(planNavigation(link, false)).toEqual({ action: "stash-then-login", path: "/game/abc123" });
  });

  test("malformed → home regardless of auth", () => {
    expect(planNavigation("https://www.gameground.net/nope", true)).toEqual({ action: "home" });
    expect(planNavigation("garbage", false)).toEqual({ action: "home" });
  });
});
