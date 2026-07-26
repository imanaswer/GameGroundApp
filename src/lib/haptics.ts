/**
 * MOTION.md §4 — the haptics map, and the ONLY expo-haptics import site.
 * Nothing else vibrates; haptics on scroll or per-cell is a review-blocker.
 */
import * as Haptics from "expo-haptics";

const swallow = () => {}; // haptics are decoration — never let them throw into UI code

/** chips, tabs, toggles, segments, stepper */
export const selection = () => Haptics.selectionAsync().catch(swallow);

/** primary button press */
export const buttonPress = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow);

/** join / booking success */
export const success = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow);

/** payment success — double-beat */
export const paymentSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(swallow), 120);
};

/** tier-up badge landing */
export const tierUp = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(swallow);

/** warning / cutoff rejection / blocked sheet-dismiss mid-verify */
export const warning = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(swallow);

/** delete confirm */
export const destructive = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(swallow);

/** pull-to-refresh trigger */
export const refresh = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow);
