/**
 * DESIGN_SYSTEM.md §10.3 — the design system made executable. Every component in every
 * ✱ state, reviewed side-by-side against the kit. Kept permanently; dev-only route.
 */
import { Redirect } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

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
  StickyCTA,
} from "@/components/chrome";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  CardSkeleton,
  Chip,
  ChipRow,
  GamesIcon,
  Input,
  LiveChip,
  SearchBar,
  Skeleton,
  SlotBar,
  Stars,
  TierBadge,
} from "@/components/ds";
import { color, icon as iconSize, layout, space, tier, type as t } from "@/lib/tokens";

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
  venue: "Turf Park",
  when: "Today 7:00 PM",
  price: "₹120",
  fillingFast: true,
  players: PEOPLE,
  organizerTier: "gold",
  joined: 11,
  total: 14,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

export default function Catalog() {
  const [chip, setChip] = useState<"all" | "football" | "cricket">("all");
  const [seg, setSeg] = useState<"camps" | "workshops" | "events">("camps");
  const [checkout, setCheckout] = useState<CheckoutState>("methods");

  if (!__DEV__) return <Redirect href="/home" />;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Component catalog</Text>

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
            data={{ id: "c1", name: "Coach Ramesh", sport: "Football", rating: 4.7, price: "₹500/hr" }}
            onPress={() => {}}
          />
          <RegistrationCard
            data={{ id: "r1", kind: "camp", title: "Summer Skills Camp", when: "Jun 1–15", price: "₹2,500", registered: 18, capacity: 20 }}
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

        <Section title="EmptyState">
          <View style={styles.stateBox}>
            <EmptyState
              icon={<GamesIcon size={iconSize.empty} color={color.red} />}
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
              { key: "success", label: "Success" },
              { key: "failure", label: "Failure" },
            ]}
            value={checkout}
            onChange={setCheckout}
          />
          <View style={styles.sheetHost}>
            <CheckoutSheet state={checkout} amount="₹120" onPay={() => {}} onRetry={() => {}} />
          </View>
        </Section>

        <View style={{ height: 120 }} />
      </ScrollView>

      <StickyCTA price="₹120" caption="per player" ctaLabel="Join game" onPress={() => {}} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.screenX, paddingTop: space(4), gap: space(6) },
  h1: { ...t.title1, color: color.text },
  section: { gap: space(3) },
  label: { ...t.label, color: color.dim },
  body: { gap: space(3) },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space(2) },
  stateBox: { height: 320, backgroundColor: color.bg, borderRadius: 20, borderWidth: 1, borderColor: color.border, overflow: "hidden" },
  sheetHost: { borderRadius: 20, overflow: "hidden", backgroundColor: color.bg },
});
