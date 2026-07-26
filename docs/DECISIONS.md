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
| 10 | **OPEN — needs ratification** | **Razorpay native SDK for New Architecture.** `react-native-razorpay` is unsupported on RN 0.86 / New Arch (bridgeless-only) and was removed in M0. M6 built the entire SDK-agnostic checkout (create-order → verify → §9.2 failure matrix → §9.4 reconciliation) and isolated the ONE native call in `src/lib/razorpay.ts` (`openCheckout`), which throws `RazorpayUnavailableError` until this is decided. **Options:** (a) Razorpay's newer official RN SDK, (b) an interop-layer shim, (c) the hosted Razorpay checkout web-view. Wiring the chosen option touches only `src/lib/razorpay.ts`. M6 device exit criteria (test-mode payment, UPI intent, live ₹1) cannot pass until this lands. | **Anaswer — pending** |
