/**
 * M12/M13 — deep-link resolver. Notification data.url and web/scheme links map to app routes;
 * anything unmappable returns null so the caller can fall back to home (never a crash).
 */
import { resolveDeepLink } from "@/lib/deeplinks";

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
});
