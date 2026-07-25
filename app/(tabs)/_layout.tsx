import { Tabs } from "expo-router";

import { CoachesIcon, DiscoverIcon, GamesIcon, HomeIcon, LeadersIcon } from "@/components/ds/icons";
import { color, type } from "@/lib/tokens";

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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.red,
        tabBarInactiveTintColor: color.dim2,
        tabBarStyle: { backgroundColor: color.card, borderTopColor: color.border },
        tabBarLabelStyle: { ...type.micro, textTransform: "uppercase" },
      }}
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
