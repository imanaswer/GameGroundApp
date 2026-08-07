// Checkout components — visual states in M3, wired in M6 (DESIGN_SYSTEM.md §7).
export { CheckoutSheet, type CheckoutState, type TimelinePhase } from "./CheckoutSheet";
// Not a checkout — player-hosted games are settled host-to-player, outside GG (§9A).
export { HostPaymentPanel, type HostPaymentPanelProps } from "./HostPaymentPanel";
