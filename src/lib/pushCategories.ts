/**
 * Push notification categories (Developer PRD §10.3). Single source of truth so the Settings
 * toggles and the server-prefs payload can never drift. Hard rule: no marketing pushes in v1.
 */
export const PUSH_CATEGORIES = [
  { key: "reminders", label: "Game reminders" },
  { key: "waitlist", label: "Waitlist updates" },
  { key: "event_updates", label: "Event announcements" },
  { key: "payments", label: "Payment updates" },
  { key: "tier", label: "Tier changes" },
  { key: "game_changes", label: "Game changes" },
] as const;

export type PushCategory = (typeof PUSH_CATEGORIES)[number]["key"];

/** Per-category on/off; absent key = on (server treats `prefs[cat] !== false` as enabled). */
export type PushPrefs = Partial<Record<PushCategory, boolean>>;

export const DEFAULT_PREFS: Record<PushCategory, boolean> = {
  reminders: true,
  waitlist: true,
  event_updates: true,
  payments: true,
  tier: true,
  game_changes: true,
};
