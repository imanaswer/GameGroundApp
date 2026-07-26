/**
 * Query-key factory (Developer PRD §6.1). Keys are arrays built here — never inline
 * strings in screens. One entry per domain; mutations invalidate against these.
 */
export type GameFilters = {
  q?: string;
  sport?: string;
  status?: "open" | "completed" | "all";
};

export const keys = {
  me: ["me"] as const,
  games: {
    all: ["games"] as const,
    list: (filters: GameFilters) => ["games", "list", filters] as const,
    detail: (id: string) => ["games", "detail", id] as const,
  },
  venues: {
    all: ["venues"] as const,
    slots: (venueId: string) => ["venues", venueId, "slots"] as const,
  },
  coaches: {
    all: ["coaches"] as const,
    list: (filters: { sport?: string; q?: string }) => ["coaches", "list", filters] as const,
    detail: (id: string) => ["coaches", "detail", id] as const,
  },
  registerables: {
    list: (kind: string, q: string) => ["registerables", kind, "list", q] as const,
    detail: (kind: string, id: string) => ["registerables", kind, "detail", id] as const,
  },
} as const;
