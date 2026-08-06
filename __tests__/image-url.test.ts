/**
 * Image URL absolutisation.
 *
 * `/api/games` sends its sport backdrops root-relative ("/sports/football-01.webp"). The browser
 * resolves those against the page origin; React Native cannot, so every game image on device was
 * rendering as an empty placeholder while the absolute Cloudinary/Unsplash images beside them
 * loaded fine. These cases pin both halves — rewrite the relative ones, leave the rest alone.
 */
import { resolveImageUrl } from "@/lib/imageUrl";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://www.gameground.net" },
}));

describe("resolveImageUrl", () => {
  it("prefixes the site origin onto a root-relative path", () => {
    // The exact shape /api/games returns today.
    expect(resolveImageUrl("/sports/football-01.webp")).toBe(
      "https://www.gameground.net/sports/football-01.webp",
    );
  });

  it("leaves an absolute URL untouched", () => {
    const cloudinary = "https://res.cloudinary.com/dgla52vbn/image/upload/v1781876887/a.jpg";
    expect(resolveImageUrl(cloudinary)).toBe(cloudinary);
    // The Unsplash fallbacks from lib/sportImages carry a query string — it must survive.
    const unsplash = "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80";
    expect(resolveImageUrl(unsplash)).toBe(unsplash);
  });

  it("treats empty and blank as no image, not as a path", () => {
    // Workshops without a cover send "" rather than omitting the field; `?? null` let it through.
    expect(resolveImageUrl("")).toBeNull();
    expect(resolveImageUrl("   ")).toBeNull();
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl(undefined)).toBeNull();
  });

  it("handles a bare relative path and a protocol-relative URL", () => {
    expect(resolveImageUrl("sports/badminton-05.webp")).toBe(
      "https://www.gameground.net/sports/badminton-05.webp",
    );
    expect(resolveImageUrl("//res.cloudinary.com/x/a.jpg")).toBe(
      "https://res.cloudinary.com/x/a.jpg",
    );
  });

  it("passes through non-http schemes rather than mangling them into a path", () => {
    expect(resolveImageUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(resolveImageUrl("file:///var/tmp/a.jpg")).toBe("file:///var/tmp/a.jpg");
  });
});
