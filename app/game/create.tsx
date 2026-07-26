/**
 * Create-game stepper (M7). 4 steps, each validated by its own zod slice before advancing
 * (§7). Venue + slot come from /venues + /venues/:id/slots. The server re-checks the slot
 * at create time — the client just gathers input.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CreateGameStep } from "@/api/schemas";
import { Screen } from "@/components/chrome";
import { BackIcon, Button, Chip, Input, Press, Skeleton } from "@/components/ds";
import { useCreateGame, useVenueSlots, useVenues } from "@/hooks/queries";
import { formatWhen } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { color, layout, radius, space, type } from "@/lib/tokens";

const SPORTS = ["Football", "Cricket", "Badminton", "Basketball", "Tennis", "Volleyball"];
const SKILLS = ["Any", "Beginner", "Intermediate", "Advanced"];
const STEPS = ["Basics", "Venue", "Size", "Details"] as const;

export default function CreateGame() {
  const router = useRouter();
  const create = useCreateGame();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: "",
    sport: "",
    venueId: "",
    slotId: "",
    slotsTotal: "10",
    skillLevel: "Any",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

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
        venueId: form.venueId,
        slotId: form.slotId,
        slotsTotal: Number(form.slotsTotal),
        skillLevel: form.skillLevel === "Any" ? undefined : form.skillLevel,
        description: form.description.trim() || undefined,
      },
      {
        onSuccess: (game) => {
          haptics.success();
          router.replace(`/game/${game.id}`);
        },
      },
    );
  };

  const back = () => (step === 0 ? router.back() : setStep((s) => s - 1));

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Press accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.9} onPress={back} style={styles.backBtn}>
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
              value={form.slotsTotal}
              onChangeText={set("slotsTotal")}
              error={errors.slotsTotal}
              keyboardType="number-pad"
            />
            <Text style={styles.label}>Skill level</Text>
            <View style={styles.chipWrap}>
              {SKILLS.map((s) => (
                <Chip key={s} label={s} active={form.skillLevel === s} onPress={() => set("skillLevel")(s)} />
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <Input
            label="Description (optional)"
            value={form.description}
            onChangeText={set("description")}
            error={errors.description}
            placeholder="Bring water. Studs recommended."
            multiline
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={step === STEPS.length - 1 ? "Create game" : "Continue"}
          onPress={advance}
          loading={create.isPending}
        />
      </View>
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

  return (
    <>
      <Text style={styles.label}>Venue</Text>
      {venues.isLoading ? (
        <Skeleton height={44} />
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
          ) : (
            <View style={styles.slotList}>
              {slots.data
                ?.filter((s) => s.available)
                .map((s) => (
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
  header: { flexDirection: "row", alignItems: "center", gap: space(3), paddingHorizontal: layout.screenX, paddingTop: space(2) },
  backBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
  stepLabel: { ...type.label, color: color.dim },
  progress: { flexDirection: "row", gap: space(1.5), paddingHorizontal: layout.screenX, paddingVertical: space(3) },
  progressBar: { flex: 1, height: 3, borderRadius: 999, backgroundColor: color.border2 },
  progressBarOn: { backgroundColor: color.red },
  scroll: { paddingHorizontal: layout.screenX, paddingTop: space(3), paddingBottom: space(10) },
  label: { ...type.label, color: color.dim, marginBottom: space(2) },
  labelGap: { marginTop: space(5) },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  err: { ...type.caption, color: color.redLight, marginTop: space(2) },
  slotList: { gap: space(2) },
  slot: { backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, padding: space(3.5) },
  slotOn: { borderColor: color.red, backgroundColor: color.redWash },
  slotText: { ...type.body, color: color.text },
  footer: { paddingHorizontal: layout.screenX, paddingBottom: space(8), paddingTop: space(3) },
});
