# DECISIONS — Game Ground Mobile

One line per decision. The product PRD §12 mirrors decisions 1–8; new entries land here first.

| # | Date | Decision | Owner |
|---|---|---|---|
| 1 | 10 Jul 2026 | React Native/Expo, single codebase, both platforms | Anaswer |
| 2 | 10 Jul 2026 | Launch scope = full web parity; phased internal build order (M0–M17) | Anaswer |
| 3 | 10 Jul 2026 | Reuse existing Next.js API; refresh-token auth added server-side (M1) | Anaswer |
| 4 | 10 Jul 2026 | Payment vulnerability fixes are a Phase 0 / M1 blocker | Anaswer |
| 5 | 10 Jul 2026 | Home/For-You tab in v1 (+2 weeks, ~15-week launch); 5-tab bar (Home·Games·Coaches·Discover·Leaders), pending Anain sign-off | Anaswer |
| 6 | 10 Jul 2026 | Streaks, XP & named achievements deferred to v1.1; v1 = tier system only | Anaswer |
| 7 | 10 Jul 2026 | Kit = floor (layout/color/type); docs/MOTION.md = binding interaction contract; external redesign prompts superseded by CLAUDE.md Design Bar | Anaswer |
| 8 | 10 Jul 2026 | Design Excellence chosen over direct port; GameGround_Design_Excellence_v3.html is the approved motion/UX reference artifact | Anaswer |
| 10 | 26 Jul 2026 | **Razorpay = hosted Standard Checkout in a WebView** (`react-native-webview`, New-Arch-safe). Chosen over (a) `react-native-razorpay` — unsupported on RN 0.86 / New Arch, bridgeless-only — and (b) an interop shim (fragile for a solo maintainer). Rationale: zero native-module New-Arch risk (the BACKLOG "solo-maintainer outage" concern); server re-verifies the HMAC binding on `/payments/verify` and the webhook settles independently (§9.3), so the WebView adapter cannot create a money error the server won't catch. Implemented behind the unchanged `openCheckout` seam (`src/lib/razorpay.tsx` + `<RazorpayHost/>`); the checkout machine and every screen are untouched. **Still requires a physical-device pass** (test-mode payment, Android UPI intent, one live ₹1) — an exit criterion for any payment integration. | Anaswer |
