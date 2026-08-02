/**
 * THE native payment seam — the ONLY place that opens the gateway checkout.
 *
 * DECISION (DECISIONS.md #10, ratified 2026-07-26): hosted Razorpay Standard Checkout in a
 * WebView. Chosen over `react-native-razorpay` (unsupported on RN 0.86 / New Architecture,
 * bridgeless-only) and an interop shim (fragile for a solo maintainer). react-native-webview
 * supports New Arch, so there is no native-module risk. The server re-verifies the HMAC
 * binding on /payments/verify and the webhook settles independently (§9.3) — the WebView
 * adapter cannot create a money error the server won't catch.
 *
 * The public API (`openCheckout`) is unchanged from the M6 seam, so the whole checkout
 * machine, useCheckout, and every screen stay exactly as they were.
 *
 * ⚠️ Still requires a physical-device pass (test-mode payment + Android UPI intent + one
 * live ₹1) — that is an exit criterion for ANY payment integration, not a gap in this one.
 */
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from "expo-screen-capture";
import { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import type { CreatedOrder, RazorpayResult } from "@/api/types";
import { RazorpayCancelledError, RazorpayUnavailableError } from "@/lib/razorpay-errors";
import { color } from "@/lib/tokens";

export { RazorpayCancelledError, RazorpayUnavailableError };

export type CheckoutPrefill = { email?: string; contact?: string };

/* ── Imperative bridge ──────────────────────────────────────────────────────
 * openCheckout() stays a plain async function; a single mounted <RazorpayHost/>
 * presents the WebView and settles the pending promise. */

type Pending = {
  order: CreatedOrder;
  prefill: CheckoutPrefill;
  resolve: (r: RazorpayResult) => void;
  reject: (e: Error) => void;
};

let hostReady = false;
let openRequest: ((p: Pending) => void) | null = null;

/**
 * Opens the gateway and resolves with the signed result to hand to /payments/verify.
 * Amount comes from the server-issued order — the client passes it through, never computes it.
 */
export function openCheckout(order: CreatedOrder, prefill: CheckoutPrefill): Promise<RazorpayResult> {
  if (!hostReady || !openRequest) return Promise.reject(new RazorpayUnavailableError());
  return new Promise<RazorpayResult>((resolve, reject) => {
    openRequest!({ order, prefill, resolve, reject });
  });
}

/** Razorpay Standard Checkout page. checkout.js posts the signed result (or a cancel) back. */
function checkoutHtml(order: CreatedOrder, prefill: CheckoutPrefill): string {
  const options = {
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amountPaise, // server-issued; the client never sets its own amount
    currency: order.currency,
    name: "Game Ground",
    prefill: { email: prefill.email ?? "", contact: prefill.contact ?? "" },
    theme: { color: color.red },
  };
  const post = (payload: string) => `window.ReactNativeWebView.postMessage(${payload})`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="background:${color.bg}">
<script>
  var opts = ${JSON.stringify(options)};
  opts.handler = function (r) { ${post("JSON.stringify({ type: 'success', data: r })")} };
  opts.modal = { ondismiss: function () { ${post("JSON.stringify({ type: 'cancel' })")} }, escape: false };
  try {
    var rzp = new Razorpay(opts);
    rzp.on('payment.failed', function (resp) {
      ${post("JSON.stringify({ type: 'failed', error: (resp && resp.error && resp.error.description) || 'Payment failed' })")};
    });
    rzp.open();
  } catch (e) {
    ${post("JSON.stringify({ type: 'failed', error: 'Checkout failed to load' })")};
  }
</script></body></html>`;
}

/** Mounted once in the root layout. Presents the checkout WebView on demand. */
export function RazorpayHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    hostReady = true;
    openRequest = (p) => {
      settled.current = false;
      setPending(p);
    };
    return () => {
      hostReady = false;
      openRequest = null;
    };
  }, []);

  const close = () => setPending(null);

  // FLAG_SECURE (§9.5 / S1.6) belongs here and nowhere else: the gateway WebView is the only
  // surface a card number or UPI id is ever visible on. The CheckoutSheet before it shows a radio
  // pair and a server-issued amount — nothing worth blocking a screenshot of.
  //
  // Skipped under __DEV__ deliberately. FLAG_SECURE blanks the window on any non-secure display —
  // emulator, scrcpy/mirroring, Expo Go — and a black unresponsive app is indistinguishable from a
  // hang. Setting it from useCheckout meant that happened the moment "Book" was tapped.
  const gatewayOpen = !!pending;
  useEffect(() => {
    if (__DEV__ || !gatewayOpen) return;
    preventScreenCaptureAsync().catch(() => {});
    return () => void allowScreenCaptureAsync().catch(() => {});
  }, [gatewayOpen]);

  const onMessage = (e: WebViewMessageEvent) => {
    if (!pending || settled.current) return;
    let msg: { type: string; data?: RazorpayResult; error?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    settled.current = true;
    close();
    if (msg.type === "success" && msg.data) pending.resolve(msg.data);
    else if (msg.type === "cancel") pending.reject(new RazorpayCancelledError());
    else pending.reject(new Error(msg.error ?? "Payment failed"));
  };

  return (
    <Modal
      visible={!!pending}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        // Hardware back = dismiss (§9.2 row 1).
        if (pending && !settled.current) {
          settled.current = true;
          const p = pending;
          close();
          p.reject(new RazorpayCancelledError());
        }
      }}
    >
      <View style={styles.root}>
        {pending && (
          <WebView
            source={{ html: checkoutHtml(pending.order, pending.prefill) }}
            onMessage={onMessage}
            javaScriptEnabled
            originWhitelist={["*"]}
            style={styles.web}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  web: { flex: 1, backgroundColor: color.bg },
});
