/**
 * Checkout seam error types — kept in their own import-free module so the pure state
 * machine and its tests never transitively load the native WebView (react-native-webview).
 */

export class RazorpayUnavailableError extends Error {
  constructor() {
    super("Payment checkout is not available in this build yet.");
    this.name = "RazorpayUnavailableError";
  }
}

/** User dismissed the checkout — an intentional exit, not a failure (§9.2 row 1). */
export class RazorpayCancelledError extends Error {
  constructor() {
    super("Payment cancelled");
    this.name = "RazorpayCancelledError";
  }
}
