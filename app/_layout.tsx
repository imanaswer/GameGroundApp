import NetInfo from "@react-native-community/netinfo";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { setClientHandlers } from "@/api/client";
import { ToastProvider } from "@/components/chrome";
import { TierUpProvider } from "@/components/social/TierUp";
import { AuthProvider } from "@/hooks/useAuth";
import { DeepLinkProvider } from "@/hooks/useDeepLinks";
import { PushProvider } from "@/hooks/usePush";
import { initAnalytics } from "@/lib/analytics";
import { persistOptions } from "@/lib/query-persist";
import { RazorpayHost } from "@/lib/razorpay";
import { initSentry } from "@/lib/sentry";
import { color } from "@/lib/tokens";

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

/** Routes the api client's global outcomes (§4.1): dead session → login, 426 → upgrade wall. */
function ClientHandlerBridge() {
  const router = useRouter();
  useEffect(() => {
    setClientHandlers({
      onSessionExpired: () => router.replace("/login"),
      onUpgradeRequired: () => router.replace("/upgrade-required"),
    });
    return () => setClientHandlers({});
  }, [router]);
  return null;
}

export default function RootLayout() {
  // Vendored rather than pulled from @expo-google-fonts — those packages ship every
  // weight and italic (~14MB) and metro bundles the lot. Six files is all we use.
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular: require("@/assets/fonts/InstrumentSerif_400Regular.ttf"),
    Inter_400Regular: require("@/assets/fonts/Inter_400Regular.ttf"),
    Inter_500Medium: require("@/assets/fonts/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("@/assets/fonts/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("@/assets/fonts/Inter_700Bold.ttf"),
    Inter_800ExtraBold: require("@/assets/fonts/Inter_800ExtraBold.ttf"),
  });

  useEffect(() => {
    // Hide on error too — a missing font must not leave the user staring at the splash.
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

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
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <ToastProvider>
            <DeepLinkProvider>
              <PushProvider>
                <TierUpProvider>
                <ClientHandlerBridge />
                <RazorpayHost />
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="game/create" options={{ presentation: "modal" }} />
                  <Stack.Screen name="search" options={{ presentation: "modal" }} />
                  <Stack.Screen name="upgrade-required" options={{ gestureEnabled: false }} />
                </Stack>
                </TierUpProvider>
              </PushProvider>
            </DeepLinkProvider>
          </ToastProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
