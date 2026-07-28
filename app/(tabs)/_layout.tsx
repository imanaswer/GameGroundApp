import { Tabs } from "expo-router";

import { TabBar } from "@/components/chrome/TabBar";
import { CoachesIcon, DiscoverIcon, GamesIcon, HomeIcon, LeadersIcon } from "@/components/ds/icons";

/** Tab order is fixed by Decision 5: home · games · coaches · discover · leaders. */
const TABS = [
  { name: "home", title: "Home", Icon: HomeIcon },
  { name: "games", title: "Games", Icon: GamesIcon },
  { name: "coaches", title: "Coaches", Icon: CoachesIcon },
  { name: "discover", title: "Discover", Icon: DiscoverIcon },
  { name: "leaders", title: "Leaders", Icon: LeadersIcon },
] as const;

export default function TabsLayout() {
  return (
    <Tabs
      // Custom bar owns the chrome (blur, spring icon, indicator, halo, haptic) per DS §5 / MOTION §2.
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map(({ name, title, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ title, tabBarIcon: ({ color: tint }) => <Icon color={tint} /> }}
        />
      ))}
    </Tabs>
  );
}
