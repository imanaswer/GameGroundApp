import { Redirect } from "expo-router";
import { TopTabs } from "expo-router/js-top-tabs";

import { TabBar, type TabBarProps } from "@/components/chrome/TabBar";
import { CoachesIcon, DiscoverIcon, GamesIcon, HomeIcon, LeadersIcon } from "@/components/ds/icons";
import { useAuth } from "@/hooks/useAuth";
import { icon as iconSize } from "@/lib/tokens";

/**
 * Swipe-paged tabs (Decision 17). expo-router's `<Tabs>` is bottom-tabs and cannot page
 * horizontally, so the tab layer uses its top-tab navigator with the bar pinned to the bottom.
 *
 * This must come from `expo-router/js-top-tabs`, NOT `@react-navigation/material-top-tabs`:
 * since SDK 56 expo-router vendors its own copy and hard-errors at bundle time on a direct
 * react-navigation import. expo-router re-exports the same types, and the vendored navigator
 * needs no react-native-pager-view.
 */

/** Tab order is fixed by Decision 5: home · games · coaches · discover · leaders. */
const TABS = [
  { name: "home", title: "Home", Icon: HomeIcon },
  { name: "games", title: "Games", Icon: GamesIcon },
  { name: "coaches", title: "Coaches", Icon: CoachesIcon },
  { name: "discover", title: "Discover", Icon: DiscoverIcon },
  { name: "leaders", title: "Leaders", Icon: LeadersIcon },
] as const;

export default function TabsLayout() {
  // Tabs are signed-in-only (§5.1, same intent as app/index.tsx). A dev-client reload can land
  // directly on a tab route, bypassing the index gate — without this guard Home renders with a
  // null user (no avatar, "there" greeting, guest/placeholder data). Redirect signed-out users.
  const { status } = useAuth();
  if (status === "restoring") return null; // splash still up while the session restores
  if (status === "signedOut") return <Redirect href="/login" />;

  return (
    <TopTabs
      // Custom bar owns the chrome (fill, spring icon, indicator, halo, haptic) per DS §5 / MOTION §2.
      tabBar={(props: TabBarProps) => <TabBar {...props} />}
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        // lazy:false by explicit choice — all five tabs mount at launch so a swipe never lands on
        // a placeholder. Costs startup work and memory; verify against M15's <2500ms cold start
        // on a real build (docs/PERF.md) before this ships.
        lazy: false,
      }}
    >
      {TABS.map(({ name, title, Icon }) => (
        <TopTabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color: tint }: { color: string }) => <Icon color={tint} size={iconSize.tab} />,
          }}
        />
      ))}
    </TopTabs>
  );
}
