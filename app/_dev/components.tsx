/**
 * DESIGN_SYSTEM.md §10.3 — the design system made executable. Every component in every
 * ✱ state, reviewed side-by-side against the kit. Kept permanently; dev-only route.
 */
import { Redirect } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  RegistrationCard,
  CoachCard,
  GameCard,
  type GameCardData,
} from "@/components/cards";
import { CheckoutSheet, type CheckoutState } from "@/components/checkout";
import {
  EmptyState,
  ErrorState,
  OfflineBanner,
  Screen,
  SegmentedControl,
  SetupCard,
  Sheet,
  Spinner,
  StickyCTA,
  TabBarView,
} from "@/components/chrome";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  CardSkeleton,
  Chip,
  ChipRow,
  CoachesIcon,
  DiscoverIcon,
  GamesIcon,
  HomeIcon,
  InfoIcon,
  LeadersIcon,
  Input,
  LiveChip,
  SearchBar,
  Skeleton,
  SlotBar,
  Stars,
  TierBadge,
} from "@/components/ds";
import { color, icon as iconSize, layout, space, tier, type as t } from "@/lib/tokens";
import { useTheme } from "@/theme/ThemeProvider";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

const PEOPLE = [
  { name: "Arjun Nair" },
  { name: "Priya Menon" },
  { name: "Rahul Das" },
  { name: "Sana K" },
  { name: "Vivek R" },
  { name: "Divya P" },
];

const GAME: GameCardData = {
  id: "g1",
  title: "Evening Football 7s",
  sport: "Football",
  level: "All Levels",
  venue: "Turf Park",
  when: "Today 7:00 PM",
  price: "₹120",
  fillingFast: true,
  players: PEOPLE,
  organizerTier: "gold",
  joined: 11,
  total: 14,
};

/** Mirrors app/(tabs)/_layout's list (Decision 5) — the catalog shows the real five. */
const TAB_DEMO = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "games", label: "Games", Icon: GamesIcon },
  { key: "coaches", label: "Coaches", Icon: CoachesIcon },
  { key: "discover", label: "Discover", Icon: DiscoverIcon },
  { key: "leaders", label: "Leaders", Icon: LeadersIcon },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(sheets);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

export default function Catalog() {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  const [chip, setChip] = useState<"all" | "football" | "cricket">("all");
  const [seg, setSeg] = useState<"camps" | "workshops" | "events">("camps");
  const [checkout, setCheckout] = useState<CheckoutState>("methods");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const { mode, setMode } = useTheme();

  if (!__DEV__) return <Redirect href="/home" />;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Component catalog</Text>

        {/* DS §10.3 — the catalog is this document made executable, and since Decision 24 the
            document describes two palettes. Every component below has to be checkable in both,
            so the switch lives here rather than requiring a trip to Profile → Appearance. */}
        <Section title="Theme — every component below renders in the active one">
          <View style={styles.themeRow}>
            {(["light", "dark", "system"] as const).map((m) => (
              <Chip key={m} label={m} active={mode === m} onPress={() => setMode(m)} />
            ))}
          </View>
        </Section>

        <Section title="Button — variants & states">
          <Button title="Primary" onPress={() => {}} />
          <Button title="Secondary" variant="secondary" onPress={() => {}} />
          <Button title="Ghost" variant="ghost" onPress={() => {}} />
          <Button title="Loading" loading onPress={() => {}} />
          <Button title="Disabled" disabled onPress={() => {}} />
          <Button title="Book" variant="mini" onPress={() => {}} />
        </Section>

        <Section title="Chip / ChipRow">
          <View style={styles.rowWrap}>
            <Chip label="Rest" onPress={() => {}} />
            <Chip label="Active" active onPress={() => {}} />
            <Chip label="Disabled" disabled onPress={() => {}} />
          </View>
          <ChipRow
            items={[
              { key: "all", label: "All sports" },
              { key: "football", label: "Football" },
              { key: "cricket", label: "Cricket" },
            ]}
            value={chip}
            onChange={setChip}
          />
        </Section>

        <Section title="Badge / TierBadge / LiveChip">
          <View style={styles.rowWrap}>
            <Badge label="New" />
            <Badge label="Free" tone="success" />
            <LiveChip label="Filling fast" />
          </View>
          <View style={styles.rowWrap}>
            {(Object.keys(tier) as (keyof typeof tier)[]).map((k) => (
              <TierBadge key={k} tier={k} />
            ))}
          </View>
        </Section>

        <Section title="Avatar / AvatarStack">
          <View style={styles.rowWrap}>
            <Avatar name="Arjun Nair" size={44} />
            <Avatar name="You" isSelf size={44} />
            <AvatarStack people={PEOPLE} />
          </View>
        </Section>

        <Section title="Stars">
          <View style={styles.rowWrap}>
            <Stars value={4.5} size={16} />
            <Stars value={3.2} size={16} />
            <Stars value={5} size={16} />
          </View>
        </Section>

        <Section title="SlotBar">
          <SlotBar joined={4} total={14} />
          <SlotBar joined={12} total={14} />
        </Section>

        <Section title="Input">
          <Input label="Email" placeholder="you@example.com" />
          <Input label="With hint" placeholder="ananya_s" hint="Lowercase letters, numbers and underscores." />
          <Input label="With error" placeholder="…" error="Enter a valid email" />
        </Section>

        <Section title="SearchBar">
          <SearchBar placeholder="Search games, coaches, venues" />
        </Section>

        <Section title="Skeletons">
          <Skeleton width="60%" />
          <CardSkeleton />
        </Section>

        <Section title="Cards">
          <GameCard data={GAME} onPress={() => {}} />
          <CoachCard
            data={{ id: "c1", name: "Coach Ramesh", sport: "Football", rating: 4.7, reviewCount: 42, price: "₹300–500/session" }}
            onPress={() => {}}
          />
          <RegistrationCard
            data={{ id: "r1", kind: "camp", title: "Summer Skills Camp", when: "Jun 1–15", price: "₹2,500", registered: 18, capacity: 20 }}
            onPress={() => {}}
          />
        </Section>

        <Section title="Rail cards — compact (Home rails)">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            <GameCard data={GAME} compact onPress={() => {}} />
            <CoachCard
              data={{ id: "c2", name: "Coach Ramesh", sport: "Football", rating: 4.7, reviewCount: 42, price: "₹300/session" }}
              compact
              onPress={() => {}}
            />
            <CoachCard
              data={{ id: "c3", name: "Coach Neha", sport: "Tennis", rating: 0, reviewCount: 0, price: "On request" }}
              compact
              onPress={() => {}}
            />
          </ScrollView>
        </Section>

        <Section title="Spinner — default, brand scale, tinted">
          {/* The black tint is shown on the page ground; at brand scale it renders white inside
              BrandLoader's black field, which the catalog cannot host without a full-bleed row. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(6) }}>
            <Spinner />
            <Spinner size={54} stroke={1.5} />
            <Spinner size={30} tint={color.text} />
          </View>
        </Section>

        <Section title="SetupCard — dismissible & static">
          <SetupCard
            icon={<InfoIcon color={color.text} />}
            title="Set your sports"
            body="Pick the sports you play to personalise your games."
            onPress={() => {}}
            onDismiss={() => {}}
          />
          <SetupCard
            icon={<InfoIcon color={color.text} />}
            title="Verify your number"
            body="Confirm your phone to host games and receive updates."
            onPress={() => {}}
          />
        </Section>

        <Section title="SegmentedControl">
          <SegmentedControl
            segments={[
              { key: "camps", label: "Camps" },
              { key: "workshops", label: "Workshops" },
              { key: "events", label: "Events" },
            ]}
            value={seg}
            onChange={setSeg}
          />
        </Section>

        {/* The real bar needs a pager to cross-fade against, so the catalog renders the
            presentational half with a static index — enough to check ink-vs-idle, the weight
            change, and both palettes. The swipe-tracking cross-fade only exists under (tabs). */}
        <Section title="TabBar — tap a tab to move the ink">
          <View style={styles.tabBox}>
            <TabBarView
              floating={false}
              index={tab}
              items={TAB_DEMO.map(({ key, label, Icon }, i) => ({
                key,
                label,
                icon: (tint: string) => <Icon color={tint} size={iconSize.tab} />,
                onPress: () => setTab(i),
              }))}
            />
          </View>
        </Section>

        <Section title="EmptyState">
          <View style={styles.stateBox}>
            <EmptyState
              icon={<GamesIcon size={iconSize.empty} color={color.primary} />}
              headline="No games tonight — yet."
              body="Someone has to go first. Why not you?"
              cta={{ label: "Create one", onPress: () => {} }}
            />
          </View>
        </Section>

        <Section title="ErrorState / OfflineBanner">
          <OfflineBanner />
          <View style={styles.stateBox}>
            <ErrorState message="Couldn’t load games. Check your connection." onRetry={() => {}} />
          </View>
        </Section>

        <Section title="CheckoutSheet — states">
          <ChipRow
            items={[
              { key: "methods", label: "Methods" },
              { key: "processing", label: "Processing" },
              { key: "reconciling", label: "Reconciling" },
              { key: "success", label: "Success" },
              { key: "failure", label: "Failure" },
              { key: "unresolved", label: "Unresolved" },
            ]}
            value={checkout}
            onChange={setCheckout}
          />
          <View style={styles.sheetHost}>
            <CheckoutSheet
              state={checkout}
              phase="gateway"
              amount="₹120"
              error="Card declined by your bank."
              onPay={() => {}}
              onRetry={() => {}}
              onSupport={() => {}}
              onClose={() => {}}
            />
          </View>
        </Section>

        <Section title="Sheet (chrome) + StickyCTA confirmed state">
          <Button title="Open bottom sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
          <View style={styles.ctaBox}>
            <StickyCTA status="You’re in" ctaLabel="Leave game" buttonVariant="secondary" onPress={() => {}} />
          </View>
        </Section>

        <View style={{ height: 120 }} />
      </ScrollView>

      <StickyCTA price="₹120" caption="per player" ctaLabel="Join game" onPress={() => {}} />

      <Sheet visible={sheetOpen} onDismiss={() => setSheetOpen(false)}>
        <View style={styles.demoSheet}>
          <View style={styles.demoHandle} />
          <Text style={styles.demoTitle}>Bottom sheet</Text>
          <Text style={styles.demoBody}>Drag the handle down or tap the scrim to dismiss.</Text>
          <Button title="Close" onPress={() => setSheetOpen(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const sheets = themed(() => ({
  themeRow: { flexDirection: "row", gap: space(2) },
  scroll: { paddingHorizontal: layout.screenX, paddingTop: space(4), gap: space(6) },
  h1: { ...t.title1, color: color.text },
  section: { gap: space(3) },
  label: { ...t.label, color: color.dim },
  body: { gap: space(3) },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(2) },
  rail: { gap: space(3), paddingVertical: space(1) },
  stateBox: { height: 320, backgroundColor: color.bg, borderRadius: 20, borderWidth: 1, borderColor: color.border, overflow: "hidden" },
  sheetHost: { borderRadius: 20, overflow: "hidden", backgroundColor: color.bg },
  tabBox: { borderRadius: 20, borderWidth: 1, borderColor: color.border, overflow: "hidden", backgroundColor: color.bg },
  ctaBox: { height: 130, position: "relative", borderRadius: 20, borderWidth: 1, borderColor: color.border, overflow: "hidden", backgroundColor: color.bg },
  demoSheet: { backgroundColor: color.elev, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space(5), gap: space(3) },
  demoHandle: { width: 38, height: 4, borderRadius: 999, backgroundColor: color.border2, alignSelf: "center", marginBottom: space(2) },
  demoTitle: { ...t.title2, color: color.text },
  demoBody: { ...t.body, color: color.dim },
}));
