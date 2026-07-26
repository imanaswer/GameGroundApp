/**
 * Edit profile (M11). Avatar preset picker + basic info + sports, sticky save.
 * ponytail: presets are the identity palette rendered as initials swatches; the 12 kit
 * preset artworks are an asset task — the picker + submit contract are here.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { UserProfile } from "@/api/types";
import { HeroNav, Screen } from "@/components/chrome";
import { Button, Chip, Input, Press, Skeleton } from "@/components/ds";
import { useProfile, useUpdateProfile } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { avatarColors, color, layout, space, type } from "@/lib/tokens";

const SPORTS = ["Football", "Cricket", "Badminton", "Basketball", "Tennis", "Swimming", "Volleyball"];

export default function EditProfile() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id ?? "");
  // Keyed remount seeds the form state from props once profile arrives — no setState-in-effect.
  if (!profile) {
    return (
      <Screen>
        <Skeleton height={44} />
      </Screen>
    );
  }
  return <EditForm key={profile.id} profile={profile} />;
}

function EditForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const update = useUpdateProfile(profile.id);

  const [name, setName] = useState(profile.name);
  const [city, setCity] = useState(profile.city ?? "");
  const [sports, setSports] = useState<string[]>(profile.sports);
  const [preset, setPreset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const toggleSport = (s: string) =>
    setSports((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const save = () => {
    setError(null);
    if (name.trim().length < 1) return setError("Enter your name");
    update.mutate(
      { name: name.trim(), city: city.trim(), sports, avatarPreset: String(preset) },
      { onSuccess: () => router.back(), onError: (e) => setError((e as Error).message) },
    );
  };

  return (
    <Screen padded={false}>
      <HeroNav onBack={router.back} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Edit profile</Text>

        <Text style={styles.label}>Avatar</Text>
        <View style={styles.presets}>
          {avatarColors.map((c, i) => (
            <Press
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Avatar preset ${i + 1}`}
              scaleTo={0.9}
              onPress={() => setPreset(i)}
              style={[styles.preset, { backgroundColor: c }, preset === i && styles.presetOn]}
            >
              <Text style={styles.presetInitial}>{(name[0] ?? "?").toUpperCase()}</Text>
            </Press>
          ))}
        </View>

        <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <Input label="City" value={city} onChangeText={setCity} placeholder="Kozhikode" />

        <Text style={styles.label}>Sports</Text>
        <View style={styles.chips}>
          {SPORTS.map((s) => (
            <Chip key={s} label={s} active={sports.includes(s)} onPress={() => toggleSport(s)} />
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Save changes" onPress={save} loading={update.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.screenX, paddingTop: space(2), paddingBottom: space(10), gap: space(3) },
  title: { ...type.title1, color: color.text, marginBottom: space(2) },
  label: { ...type.label, color: color.dim },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: space(2.5) },
  preset: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  presetOn: { borderColor: color.text },
  presetInitial: { fontFamily: type.heading.fontFamily, color: color.text, fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  error: { ...type.caption, color: color.redLight },
  footer: { paddingHorizontal: layout.screenX, paddingBottom: space(8), paddingTop: space(3) },
});
