// Query hooks (Developer PRD §6.1). Screens compose these; the api layer stays hidden.
export { keys, type GameFilters } from "./keys";
export {
  useGames,
  useGame,
  useVenues,
  useVenueSlots,
  useGameAction,
  useCreateGame,
  toGameCard,
} from "./games";
export { useCoaches, useCoach, useSubmitReview, toCoachCard } from "./coaches";
export { useLeaderboard, useSearch } from "./social";
export {
  useProfile,
  useActivity,
  usePaymentsHistory,
  useUpdateProfile,
  useDeleteAccount,
} from "./users";
