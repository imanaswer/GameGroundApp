/**
 * Create-game stepper (M7). 4 steps, each validated by its own zod slice before advancing
 * (§7). Venue + slot come from /venues + /venues/:id/slots. The server re-checks the slot
 * at create time — the client just gathers input.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreateGameStep } from "@/api/schemas";
import { fieldErrorsFrom } from "@/components/auth/fields";
import { EmptyState, Screen, useToast } from "@/components/chrome";
import { BackIcon, Button, Chip, Input, Press, Skeleton, UserIcon } from "@/components/ds";
import { useCreateGame, useProfile, useVenueSlots, useVenues } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { formatWhen } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { hasWhatsAppNumber } from "@/lib/phone";
import { color, icon as iconSize, layout, radius, space, type } from "@/lib/tokens";

const SPORTS = ["Football", "Cricket", "Badminton", "Basketball", "Tennis", "Volleyball"];
// Must match the server's skillLevel enum exactly (no "Any").
const SKILLS = ["Beginner", "Intermediate", "Advanced", "All Levels"] as const;
const STEPS = ["Basics", "Venue", "Size", "Details"] as const;

/** Which step owns each field, so a server 422 can jump back to the offending step. */
const FIELD_STEP: Record<string, number> = {
  title: 0,
  sport: 0,
  venueId: 1,
  slotId: 1,
  slots: 2,
  skillLevel: 2,
  cost: 3,
  costAmount: 3,
  description: 3,
};

export default function CreateGame() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const create = useCreateGame();
  // The server requires a reachable host: POST /games 400s without a usable WhatsApp number.
  // Check it up front rather than letting someone fill four steps and get rejected at submit.
  const { user } = useAuth();
  const profile = useProfile(user?.id ?? "");
  const needsPhone = !!profile.data && !hasWhatsAppNumber(profile.data.phone);
  // Pre-select the sport when arriving from a filtered Games list (e.g. "Cricket" → Host a game).
  const { sport: sportParam } = useLocalSearchParams<{ sport?: string }>();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: "",
    sport: sportParam && SPORTS.includes(sportParam) ? sportParam : "",
    venueId: "",
    slotId: "",
    slots: "10",
    skillLevel: "All Levels",
    paid: false,
    costAmount: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Every editable field except `paid` (a boolean toggle, set inline below) is a string.
  const set = (k: Exclude<keyof typeof form, "paid">) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validateStep = (): boolean => {
    const slices = [
      () => CreateGameStep.basics.safeParse(form),
      () => CreateGameStep.venue.safeParse(form),
      () => CreateGameStep.size.safeParse(form),
      () => CreateGameStep.details.safeParse(form),
    ];
    const result = slices[step]();
    if (result.success) {
      setErrors({});
      return true;
    }
    const flat: Record<string, string> = {};
    for (const issue of result.error.issues) flat[String(issue.path[0])] = issue.message;
    setErrors(flat);
    return false;
  };

  const advance = () => {
    if (!validateStep()) return haptics.warning();
    haptics.selection();
    if (step < STEPS.length - 1) return setStep((s) => s + 1);
    create.mutate(
      {
        title: form.title.trim(),
        sport: form.sport,
        // Server derives venue/location/time from the slot — venueId is never sent.
        slotId: form.slotId,
        slots: Number(form.slots),
        skillLevel: form.skillLevel as "Beginner" | "Intermediate" | "Advanced" | "All Levels",
        cost: form.paid && Number(form.costAmount) > 0 ? `₹${Number(form.costAmount)}` : "Free",
        costAmount: form.paid ? Number(form.costAmount) || 0 : 0,
        description: form.description.trim() || undefined,
      },
      {
        onSuccess: (game) => {
          haptics.success();
          router.replace(`/game/${game.id}`);
        },
        onError: (e) => {
          // Without this the mutation failed silently — the button just stopped spinning.
          // 422 field errors: jump back to the offending step; otherwise surface the message.
          haptics.warning();
          const message = e instanceof Error ? e.message : "";
          // Safety net for the §host-reachability gate above: if the profile hadn't loaded when the
          // stepper opened, the server tells us here. Route to the fix instead of a dead-end toast.
          if (/whatsapp number/i.test(message)) {
            toast.show({ title: "Add a contact number", body: "Hosting needs a number on your profile." });
            router.replace("/profile/edit");
            return;
          }
          const inline = fieldErrorsFrom(e);
          const known = Object.keys(inline).filter((k) => k in FIELD_STEP);
          if (known.length) {
            setErrors(inline);
            setStep(Math.min(...known.map((k) => FIELD_STEP[k])));
          } else {
            toast.show({
              title: "Couldn’t create game",
              body: e instanceof Error ? e.message : "Something went wrong — please try again.",
            });
          }
        },
      },
    );
  };

  const back = () => (step === 0 ? router.back() : setStep((s) => s - 1));

  // Gate the whole stepper: players tap through to the host's WhatsApp from the game page, so a
  // game can't exist without a reachable number. Sends them straight to the field that fixes it.
  if (needsPhone) {
    return (
      <Screen padded={false}>
        <View style={styles.header}>
          <Press accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.9} hitSlop={8} onPress={() => router.back()} style={styles.backBtn}>
            <BackIcon color={color.text} />
          </Press>
        </View>
        <EmptyState
          icon={<UserIcon size={iconSize.empty} color={color.red} />}
          headline="Add a contact number first"
          body="Players reach their host on WhatsApp, so hosting needs a number on your profile."
          cta={{ label: "Add number", onPress: () => router.replace("/profile/edit") }}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Press accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.9} hitSlop={8} onPress={back} style={styles.backBtn}>
          <BackIcon color={color.text} />
        </Press>
        <Text style={styles.stepLabel}>
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </Text>
      </View>
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressBar, i <= step && styles.progressBarOn]} />
        ))}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <Input label="Game title" value={form.title} onChangeText={set("title")} error={errors.title} placeholder="Evening Football 7s" />
            <Text style={styles.label}>Sport</Text>
            <View style={styles.chipWrap}>
              {SPORTS.map((s) => (
                <Chip key={s} label={s} active={form.sport === s} onPress={() => set("sport")(s)} />
              ))}
            </View>
            {!!errors.sport && <Text style={styles.err}>{errors.sport}</Text>}
          </>
        )}

        {step === 1 && <VenueStep form={form} set={set} errors={errors} />}

        {step === 2 && (
          <>
            <Input
              label="Total players"
              value={form.slots}
              onChangeText={set("slots")}
              error={errors.slots}
              keyboardType="number-pad"
            />
            <Text style={styles.label}>Skill level</Text>
            <View style={styles.chipWrap}>
              {SKILLS.map((s) => (
                <Chip key={s} label={s} active={form.skillLevel === s} onPress={() => set("skillLevel")(s)} />
              ))}
            </View>
            {!!errors.skillLevel && <Text style={styles.err}>{errors.skillLevel}</Text>}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.label}>Cost</Text>
            <View style={styles.chipWrap}>
              <Chip
                label="Free"
                active={!form.paid}
                onPress={() => setForm((f) => ({ ...f, paid: false, costAmount: "" }))}
              />
              <Chip label="Paid" active={form.paid} onPress={() => setForm((f) => ({ ...f, paid: true }))} />
            </View>
            {form.paid && (
              <View style={styles.blockGap}>
                <Input
                  label="Amount per player (₹)"
                  value={form.costAmount}
                  onChangeText={set("costAmount")}
                  error={errors.costAmount}
                  keyboardType="number-pad"
                  placeholder="100"
                />
              </View>
            )}
            <View style={styles.blockGap}>
              <Input
                label="Description (optional)"
                value={form.description}
                onChangeText={set("description")}
                error={errors.description}
                placeholder="Bring water. Studs recommended."
                multiline
              />
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space(3) }]}>
        <Button
          title={step === STEPS.length - 1 ? "Create game" : "Continue"}
          onPress={advance}
          loading={create.isPending}
        />
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function VenueStep({
  form,
  set,
  errors,
}: {
  form: { venueId: string; slotId: string };
  set: (k: "venueId" | "slotId") => (v: string) => void;
  errors: Record<string, string>;
}) {
  const venues = useVenues();
  const slots = useVenueSlots(form.venueId || null);
  const openSlots = (slots.data ?? []).filter((s) => s.available);

  return (
    <>
      <Text style={styles.label}>Venue</Text>
      {venues.isLoading ? (
        <Skeleton height={44} />
      ) : venues.isError ? (
        <View style={styles.stateRow}>
          <Text style={styles.note}>Couldn’t load venues.</Text>
          <Button title="Retry" variant="ghost" onPress={() => venues.refetch()} />
        </View>
      ) : (venues.data?.length ?? 0) === 0 ? (
        <Text style={styles.note}>No venues available yet.</Text>
      ) : (
        <View style={styles.chipWrap}>
          {venues.data?.map((v) => (
            <Chip
              key={v.id}
              label={v.name}
              active={form.venueId === v.id}
              onPress={() => {
                set("venueId")(v.id);
                set("slotId")("");
              }}
            />
          ))}
        </View>
      )}
      {!!errors.venueId && <Text style={styles.err}>{errors.venueId}</Text>}

      {!!form.venueId && (
        <>
          <Text style={[styles.label, styles.labelGap]}>Time slot</Text>
          {slots.isLoading ? (
            <Skeleton height={44} />
          ) : slots.isError ? (
            <View style={styles.stateRow}>
              <Text style={styles.note}>Couldn’t load time slots.</Text>
              <Button title="Retry" variant="ghost" onPress={() => slots.refetch()} />
            </View>
          ) : openSlots.length === 0 ? (
            <Text style={styles.note}>No open time slots for this venue right now — try another venue.</Text>
          ) : (
            <View style={styles.slotList}>
              {openSlots.map((s) => (
                <Press
                  key={s.id}
                  accessibilityRole="button"
                  onPress={() => set("slotId")(s.id)}
                  style={[styles.slot, form.slotId === s.id && styles.slotOn]}
                >
                  <Text style={styles.slotText}>{formatWhen(s.startsAt)}</Text>
                </Press>
              ))}
            </View>
          )}
          {!!errors.slotId && <Text style={styles.err}>{errors.slotId}</Text>}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space(3), paddingHorizontal: layout.screenX, paddingTop: space(2) },
  backBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
  stepLabel: { ...type.label, color: color.dim },
  progress: { flexDirection: "row", gap: space(1.5), paddingHorizontal: layout.screenX, paddingVertical: space(3) },
  progressBar: { flex: 1, height: 3, borderRadius: 999, backgroundColor: color.border2 },
  progressBarOn: { backgroundColor: color.red },
  scroll: { paddingHorizontal: layout.screenX, paddingTop: space(3), paddingBottom: space(10) },
  label: { ...type.label, color: color.dim, marginBottom: space(2) },
  labelGap: { marginTop: space(5) },
  blockGap: { marginTop: space(4) },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  err: { ...type.caption, color: color.redLight, marginTop: space(2) },
  note: { ...type.body, color: color.dim, marginTop: space(1), flexShrink: 1 },
  stateRow: { flexDirection: "row", alignItems: "center", gap: space(2), marginTop: space(1) },
  slotList: { gap: space(2) },
  slot: { backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, padding: space(3.5) },
  slotOn: { borderColor: color.red, backgroundColor: color.redWash },
  slotText: { ...type.body, color: color.text },
  footer: { paddingHorizontal: layout.screenX, paddingTop: space(3) },
});
