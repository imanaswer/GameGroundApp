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

/**
 * The server minted a MOCK order because it has no `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`.
 *
 * Non-production only — `create-order` fails closed with a 503 in production rather than inventing
 * an order against real money. Recognising it here is what turns "I added the app's env var and
 * checkout still breaks" into a message that names the actual missing configuration, which is on
 * the SERVER: the app itself needs no gateway credential (the key ships inside each order).
 *
 * Thrown before the WebView opens. Handing `rzp_test_placeholder` to checkout.js gets an opaque
 * gateway error that looks like a bug in the app.
 */
export class RazorpayNotConfiguredError extends Error {
  constructor() {
    super("Payments aren’t configured on the server yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    this.name = "RazorpayNotConfiguredError";
  }
}
