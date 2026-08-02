/**
 * Edit profile (M11) — rebuilt to the design-kit layout: sectioned cards (Avatar, Basic
 * information, Contact & location, Sports) with a sticky Cancel / Save bar and a danger zone.
 * Wired to PATCH /users/:id (name, username, bio, location, phone, sports) + account deletion.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { UserProfile } from "@/api/types";
import { Screen } from "@/components/chrome";
import {
  AlertIcon,
  Avatar,
  BackIcon,
  Button,
  CameraIcon,
  Chip,
  Input,
  MapPinIcon,
  Press,
  Skeleton,
  TrophyIcon,
  UserIcon,
} from "@/components/ds";
import { useDeleteAccount, useProfile, useUpdateProfile } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import * as haptics from "@/lib/haptics";
import { color, layout, radius, space, type } from "@/lib/tokens";

const SPORTS = ["Football", "Cricket", "Badminton", "Basketball", "Tennis", "Swimming", "Volleyball"];
const BIO_MAX = 200;

// Preset avatar "looks". These are real image URLs, so the choice persists via avatarUrl (the app
// has no photo picker yet — that needs a native rebuild; see the note in the message).
const AVATAR_SEEDS = ["Ace", "Rally", "Striker", "Dunk", "Splash", "Spike", "Pitch", "Court"];
const avatarLook = (seed: string) =>
  `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(seed)}&size=160`;

export default function EditProfile() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id ?? "");
  // Keyed remount seeds the form state from props once the profile arrives — no setState-in-effect.
  if (!profile) {
    return (
      <Screen>
        <Skeleton height={44} />
      </Screen>
    );
  }
  return <EditForm key={profile.id} profile={profile} />;
}

function SectionCard({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>{icon}</View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {!!hint && <Text style={styles.cardHint}>{hint}</Text>}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function EditForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { logout } = useAuth();
  const update = useUpdateProfile(profile.id);
  const del = useDeleteAccount(profile.id);

  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [sports, setSports] = useState<string[]>(profile.sports);
  const [avatar, setAvatar] = useState<string | null>(profile.avatarUrl);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const toggleSport = (s: string) =>
    setSports((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const save = () => {
    setError(null);
    setFieldErrors({});
    if (name.trim().length < 1) return setFieldErrors({ name: "Enter your name" });

    const payload = {
      name: name.trim(),
      location: city.trim(),
      phone: phone.trim(),
      bio: bio.trim(),
      sports,
      // Only send a handle when the user typed one — an empty string would blank it server-side.
      ...(username.trim() ? { username: username.trim() } : {}),
      // Only send the avatar when it changed; "" clears it back to initials.
      ...(avatar !== profile.avatarUrl ? { avatarUrl: avatar ?? "" } : {}),
    };
    update.mutate(payload, {
      onSuccess: () => {
        haptics.success();
        router.back();
      },
      onError: (e) => {
        const msg = (e as Error).message;
        if (/username/i.test(msg)) setFieldErrors({ username: msg });
        else setError(msg);
      },
    });
  };

  const onDelete = () => {
    del.mutate(undefined, {
      onSuccess: async () => {
        haptics.destructive();
        await logout(); // hard logout after the server rotates identifiers
        router.replace("/login");
      },
      onError: (e) => setError((e as Error).message),
    });
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Press accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.9} hitSlop={8} onPress={router.back} style={styles.back}>
          <BackIcon size={22} color={color.text} />
        </Press>
        <View>
          <Text style={styles.eyebrow}>Settings</Text>
          <Text style={styles.title}>Edit profile</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SectionCard icon={<CameraIcon size={16} color={color.red} />} title="Avatar" hint="Pick a look, or keep your initials.">
            <View style={styles.avatarRow}>
              <Avatar name={name || profile.name} uri={avatar || undefined} size={64} isSelf />
              <Text style={styles.avatarNote}>This is how other players see you across GameGround.</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.avatarPicker}
            >
              <AvatarOption selected={!avatar} onPress={() => setAvatar(null)}>
                <Avatar name={name || profile.name} size={52} isSelf />
              </AvatarOption>
              {AVATAR_SEEDS.map((seed) => {
                const url = avatarLook(seed);
                return (
                  <AvatarOption key={seed} selected={avatar === url} onPress={() => setAvatar(url)}>
                    <Avatar name={seed} uri={url} size={52} />
                  </AvatarOption>
                );
              })}
            </ScrollView>
          </SectionCard>

          <SectionCard icon={<UserIcon size={16} color={color.red} />} title="Basic information" hint="This is what other players see.">
            <Field label="Full name">
              <Input testID="profile-name" value={name} onChangeText={setName} placeholder="Your full name" error={fieldErrors.name} />
            </Field>
            <Field label="Username">
              <Input
                value={username}
                onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="your_handle"
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldErrors.username}
                hint="Lowercase letters, numbers and underscores."
              />
            </Field>
            <Field label={`Bio · ${bio.length}/${BIO_MAX}`}>
              <TextInput
                testID="profile-bio"
                value={bio}
                onChangeText={setBio}
                maxLength={BIO_MAX}
                multiline
                placeholder="Favourite courts, the teams you follow…"
                placeholderTextColor={color.dim2}
                style={styles.textarea}
              />
            </Field>
          </SectionCard>

          <SectionCard icon={<MapPinIcon size={16} color={color.red} />} title="Contact & location">
            <Field label="Location">
              <Input value={city} onChangeText={setCity} placeholder="e.g. Kozhikode, Kerala" />
            </Field>
            <Field label="Phone (WhatsApp)">
              <Input
                testID="profile-phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
              />
              <Text style={styles.fieldNote}>Needed before you can host a game.</Text>
            </Field>
          </SectionCard>

          <SectionCard icon={<TrophyIcon size={16} color={color.red} />} title="Sports I play" hint="Pick everything you’d join a game for.">
            <View style={styles.chips}>
              {SPORTS.map((s) => (
                <Chip key={s} label={s} active={sports.includes(s)} onPress={() => toggleSport(s)} />
              ))}
            </View>
          </SectionCard>

          <View style={styles.dangerCard}>
            <View style={styles.cardHead}>
              <View style={styles.dangerIcon}>
                <AlertIcon size={16} color={color.redLight} />
              </View>
              <Text style={styles.dangerTitle}>Danger zone</Text>
            </View>
            <Text style={styles.dangerBody}>
              Deleting your account is permanent. Your profile, game history and bookings will be removed.
            </Text>
            {!confirmingDelete ? (
              <Press testID="profile-delete" accessibilityRole="button" onPress={() => setConfirmingDelete(true)} style={styles.dangerOutline}>
                <Text style={styles.dangerOutlineText}>Delete my account</Text>
              </Press>
            ) : (
              <View style={styles.dangerConfirm}>
                <Button testID="profile-delete-confirm" title="Yes, delete" onPress={onDelete} loading={del.isPending} style={styles.dangerConfirmBtn} />
                <Press accessibilityRole="button" onPress={() => setConfirmingDelete(false)} style={styles.dangerCancel}>
                  <Text style={styles.dangerCancelText}>Cancel</Text>
                </Press>
              </View>
            )}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Press accessibilityRole="button" onPress={router.back} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Press>
          <Button testID="profile-save" title="Save changes" onPress={save} loading={update.isPending} style={styles.saveBtn} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AvatarOption({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel="Select avatar"
      accessibilityState={{ selected }}
      scaleTo={0.92}
      onPress={onPress}
      style={[styles.avatarOption, selected && styles.avatarOptionSel]}
    >
      {children}
    </Press>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(3),
    paddingHorizontal: layout.screenX,
    paddingTop: space(2),
    paddingBottom: space(3),
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.border2,
  },
  eyebrow: { ...type.label, color: color.dim },
  title: { ...type.title2, color: color.text },

  scroll: { paddingHorizontal: layout.screenX, paddingBottom: space(6), gap: space(3) },

  // section card
  card: { backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, padding: space(4) },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space(3) },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.tileSm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.redSurface,
    borderWidth: 1,
    borderColor: color.redFocus,
  },
  cardTitle: { ...type.heading, color: color.text },
  cardHint: { ...type.caption, color: color.dim, marginTop: space(2), marginLeft: space(11) },
  cardBody: { marginTop: space(4), gap: space(3) },

  avatarRow: { flexDirection: "row", alignItems: "center", gap: space(4) },
  avatarNote: { ...type.caption, color: color.dim, flex: 1, lineHeight: 16 },
  avatarPicker: { gap: space(2.5), paddingVertical: space(1), paddingRight: space(2) },
  avatarOption: {
    borderRadius: 999,
    padding: 3,
    borderWidth: 2,
    borderColor: color.border,
  },
  avatarOptionSel: { borderColor: color.red },

  field: { gap: space(2) },
  fieldLabel: { ...type.caption, color: color.dim },
  fieldNote: { ...type.caption, color: color.dim2, marginTop: space(1) },
  textarea: {
    minHeight: 88,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
    color: color.text,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
    textAlignVertical: "top",
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },

  // danger zone
  dangerCard: { backgroundColor: color.redWash, borderRadius: radius.card, borderWidth: 1, borderColor: color.redSurface, padding: space(4) },
  dangerIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.tileSm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.redSurface,
    borderWidth: 1,
    borderColor: color.redFocus,
  },
  dangerTitle: { ...type.heading, color: color.redLight },
  dangerBody: { ...type.caption, color: color.dim, lineHeight: 17, marginTop: space(3), marginBottom: space(4) },
  dangerOutline: {
    alignSelf: "flex-start",
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.redFocus,
    paddingVertical: space(2.5),
    paddingHorizontal: space(4),
  },
  dangerOutlineText: { ...type.bodyStrong, color: color.redLight },
  dangerConfirm: { flexDirection: "row", gap: space(2) },
  dangerConfirmBtn: { flex: 1 },
  dangerCancel: {
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border2,
    paddingVertical: space(2.5),
    paddingHorizontal: space(4),
    alignItems: "center",
    justifyContent: "center",
  },
  dangerCancelText: { ...type.bodyStrong, color: color.dim },

  error: { ...type.caption, color: color.redLight, textAlign: "center", marginTop: space(1) },

  footer: {
    flexDirection: "row",
    gap: space(2.5),
    paddingHorizontal: layout.screenX,
    paddingTop: space(3),
    paddingBottom: space(8),
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.bg,
  },
  cancel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.border2,
    paddingHorizontal: space(5),
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  cancelText: { ...type.heading, color: color.dim },
  saveBtn: { flex: 1 },
});
