import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { color } from "@/lib/tokens";

SplashScreen.preventAutoHideAsync();

// ponytail: single client, default options tuned in M2 when the api layer lands.
const queryClient = new QueryClient();

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

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="game/create" options={{ presentation: "modal" }} />
          <Stack.Screen name="upgrade-required" options={{ gestureEnabled: false }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
