/**
 * Fallback sport backdrops for coach cards (and any sport-themed surface) when a record has no
 * cover image of its own. Keyed by loose keyword match so live API sport labels
 * ("Table Tennis", "BOXING/KICK", "Calisthenics") land on the right image. URLs are Unsplash —
 * the same source as the seed game images — and every id below was verified to resolve.
 */
const BASE = "https://images.unsplash.com";
const QUERY = "?w=800&q=80";

// Order matters: `.find` returns the first hit, so "table tennis" must precede plain "tennis".
const SPORT_IMAGES: { match: RegExp; id: string }[] = [
  { match: /badminton/i, id: "photo-1626224583764-f87db24ac4ea" },
  { match: /table\s*tennis|ping/i, id: "photo-1534158914592-062992fbe900" },
  { match: /cricket/i, id: "photo-1540747913346-19e32dc3e97e" },
  { match: /foot\s*ball|soccer|futsal/i, id: "photo-1560272564-c83b66b1ad12" },
  { match: /basket/i, id: "photo-1546519638-68e109498ffc" },
  { match: /tennis/i, id: "photo-1595435742656-5272d0b3fa82" },
  { match: /box|kick|mma|martial|muay/i, id: "photo-1549719386-74dfcbf7dbed" },
  { match: /calisthenic|fitness|gym|strength|cross\s*fit|yoga/i, id: "photo-1571019613454-1cb2f99b2d8b" },
];

const DEFAULT_ID = "photo-1517649763962-0c623066013b"; // generic stadium/sports

/** A stable, sport-appropriate backdrop URL for the given sport label. Always returns a URL. */
export function sportImage(sport: string | null | undefined): string {
  const hit = SPORT_IMAGES.find((e) => e.match.test(sport ?? ""));
  return `${BASE}/${hit?.id ?? DEFAULT_ID}${QUERY}`;
}
