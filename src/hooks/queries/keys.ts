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
} as const;
