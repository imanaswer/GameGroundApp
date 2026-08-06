import NetInfo from "@react-native-community/netinfo";
import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/core";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { QueryClient, onlineManager, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { InteractionManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { setClientHandlers } from "@/api/client";
import { HandoffProvider, SplashGate, ToastProvider, useToast } from "@/components/chrome";
import { TierUpProvider } from "@/components/social/TierUp";
import { keys } from "@/hooks/queries";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { resumePendingReconciliation } from "@/hooks/useCheckout";
import { DeepLinkProvider } from "@/hooks/useDeepLinks";
import { PushProvider } from "@/hooks/usePush";
import { initAnalytics } from "@/lib/analytics";
import { persistOptions } from "@/lib/query-persist";
import { RazorpayHost } from "@/lib/razorpay";
import { initSentry } from "@/lib/sentry";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { usePalette, useThemeTick } from "@/theme/runtime";

// Held until <SplashGate /> paints; that component owns the dismissal and the minimum on-screen
// time (Decision 18). Deliberately NOT hidden on font load — see SplashGate's handoff comment.
SplashScreen.preventAutoHideAsync();

// Single client; per-domain staleTimes live on each query hook (§6.1). gcTime ≥ persist maxAge
// so persisted entries survive to be restored offline (§8.3).
const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 24 * 60 * 60 * 1000, retry: 2 } },
});

// §6.2 — online state from NetInfo drives React Query's refetch-on-reconnect + the offline UI.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);

/**
 * §9.4 cold-start resume. If the app was killed between a debit and its verify verdict, a
 * `gg.pendingOrder` is sitting in storage with the user's money in limbo. Restart that poll once
 * per launch, as soon as there's a session to authenticate `/payments/history` with.
 *
 * Fire-and-forget by design: the poll runs up to 5 minutes in the background and must never block
 * or delay first paint. On confirmation we refresh the entity the user paid for and tell them.
 */
function PendingPaymentBridge() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const started = useRef(false);

  useEffect(() => {
    if (status !== "signedIn" || started.current) return;
    started.current = true;
    resumePendingReconciliation((pending) => {
      // Same entityType keying as useCheckout's settleSuccess — a coach order confirmed on resume
      // has to refetch the coach, since that response carries the booking that unlocks messaging.
      if (pending.entityType === "coach") {
        queryClient.invalidateQueries({ queryKey: keys.coaches.detail(pending.entityId) });
        queryClient.invalidateQueries({ queryKey: keys.coaches.all });
      } else if (pending.entityType === "game") {
        queryClient.invalidateQueries({ queryKey: keys.games.detail(pending.entityId) });
        queryClient.invalidateQueries({ queryKey: keys.games.all });
      } else {
        queryClient.invalidateQueries({ queryKey: ["registerables", pending.entityType] });
      }
      queryClient.invalidateQueries({ queryKey: keys.me });
      queryClient.invalidateQueries({ queryKey: ["payments", "history"] });
      show({
        title: "Payment confirmed",
        body: "That pending payment went through — your spot is confirmed.",
      });
    }).catch(() => {
      // A failed resume is never fatal: the record survives and the next launch retries.
    });
  }, [status, queryClient, show]);

  return null;
}

/** Routes the api client's global outcomes (§4.1): dead session → login, 426 → upgrade wall. */
function ClientHandlerBridge() {
  const router = useRouter();
  const { show } = useToast();
  useEffect(() => {
    setClientHandlers({
      onSessionExpired: () => {
        // Sessions last as long as the access token — there is no refresh yet (dev PRD §5.3), so
        // this fires on ordinary expiry, not just on a revoked session. Being dumped on the login
        // screen with no explanation reads like a bug; say what happened.
        show({ title: "Session expired", body: "Please sign in again to continue." });
        router.replace("/login");
      },
      onUpgradeRequired: () => router.replace("/upgrade-required"),
    });
    return () => setClientHandlers({});
  }, [router, show]);
  return null;
}

/**
 * The status bar is chrome the palette owns — NOT the OS's.
 *
 * expo-router mounts its own `AutoStatusBar` keyed on `useColorScheme()`, i.e. on the phone's
 * setting. With the app overridden to light on a dark phone, that renders light glyphs on our
 * light page and the clock disappears. This one follows the app, and being mounted below it wins.
 */
function SchemeStatusBar() {
  const scheme = useThemeTick();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

/**
 * The navigator paints surfaces we never touch — the scene container, the card behind a screen
 * mid-transition, the gap a swipe between tabs opens. Those come from React Navigation's own
 * theme, and expo-router does not set one, so it is `DefaultTheme`: white, permanently. On the
 * dark palette that is a white flash between every screen.
 *
 * Mapped onto our palette rather than handed `DarkTheme`, whose greys are not ours.
 */
function useNavigationTheme() {
  const scheme = useThemeTick();
  const color = usePalette();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: color.bg,
      card: color.elev,
      text: color.text,
      border: color.border,
      primary: color.primary,
      notification: color.live,
    },
  };
}

/** Split out so the navigator re-reads its theme on a scheme change without RootLayout doing it. */
function ThemedNavigator() {
  // Reactive: identity changes with the scheme, so neither React nor the compiler can hand this
  // navigator a stale theme.
  const navigationTheme = useNavigationTheme();
  const color = usePalette();
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/create" options={{ presentation: "modal" }} />
        <Stack.Screen name="search" options={{ presentation: "modal" }} />
        <Stack.Screen name="upgrade-required" options={{ gestureEnabled: false }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  
  // Vendored rather than pulled from @expo-google-fonts — those packages ship every weight and
  // italic (~14MB) and metro bundles the lot.
  //
  // Instrument Serif was dropped by Decision 20: the ported system is single-family and nothing
  // renders a serif any more. The .ttf stays in assets/ (git-tracked, so revertible) but is no
  // longer required, which keeps it out of the bundle. These five map to `FAMILY` in tokens.ts —
  // swapping to the licensed Helvetica Now means changing this map and that constant, nothing else.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require("@/assets/fonts/Inter_400Regular.ttf"),
    Inter_500Medium: require("@/assets/fonts/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("@/assets/fonts/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("@/assets/fonts/Inter_700Bold.ttf"),
    Inter_800ExtraBold: require("@/assets/fonts/Inter_800ExtraBold.ttf"),
  });

  // Analytics + crash reporting init is deferred past first frame (§13 cold-start budget).
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      initSentry();
      initAnalytics();
    });
    return () => task.cancel();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Outermost of the providers: it decides which palette every token below resolves to, and
          it holds the tree for one storage read so nothing paints in the wrong theme first. */}
      <ThemeProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <ToastProvider>
            <DeepLinkProvider>
              <PushProvider>
                <TierUpProvider>
                {/* Wraps the navigator so the post-auth brand loader paints above every screen —
                    the auth screens hand off to it and navigate underneath it. */}
                <HandoffProvider>
                <ClientHandlerBridge />
                <PendingPaymentBridge />
                <RazorpayHost />
                {/* Follows the palette: "dark" means dark GLYPHS, which are the legible ones on
                    the light ground and invisible on the dark one. */}
                <SchemeStatusBar />
                <ThemedNavigator />
                </HandoffProvider>
                </TierUpProvider>
              </PushProvider>
            </DeepLinkProvider>
          </ToastProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
      </ThemeProvider>
      {/* Last sibling = on top of the whole app, and outside the providers so a slow session
          restore or query hydration can never delay the launch mark. */}
      <SplashGate />
    </GestureHandlerRootView>
  );
}
