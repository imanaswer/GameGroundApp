/**
 * Account setup (Decision 23) — the five screens between signing up and the app: welcome, why
 * we're asking, sports interests, notifications, congratulations.
 *
 * Ported from the source's Account Setup 1–18, cut to what this app can actually honour. Its
 * product-gender and shoe-size questions are retail taxonomy with no counterpart here, and its
 * Bluetooth / tracking prompts need native modules the app does not carry. What survives is the
 * shape — a paced, skippable, one-question-per-screen flow — and the two questions that reach
 * something real: `sports` is a server field (PATCH /users/:id) and notifications are a live
 * permission. A question with nowhere to persist is a question not worth asking.
 *
 * **BLACK, as drawn.** Built light first (Decision 20's ground) and it read as a settings form:
 * the source's whole account-setup gesture is the app going dark and quiet before it opens. So
 * this is the third black surface, alongside the splash and the handoff loader (Decision 18) —
 * same argument as those two, since all three run before the app proper is on screen. It hands
 * straight over to the loader, which is the same field, so the sequence never steps.
 *
 * ONE ROUTE, not five. The steps share a progress rail and one answer set, and the back
 * affordance has to step within the flow rather than pop it — the same reasons signup is one
 * route with an internal step (Decision 22).
 *
 * Every question is skippable and the whole flow runs once: it is entered from the signup
 * acknowledgement only, and `gg.setupComplete` is written on the way out either way. Nothing here
 * gates a feature — sports stay editable in profile edit, notifications in settings.
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHandoff, useToast } from "@/components/chrome";
import { Avatar, CheckIcon, PlusIcon, Press } from "@/components/ds";
import { useUpdateProfile } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { usePush } from "@/hooks/usePush";
import * as haptics from "@/lib/haptics";
import { sportImage } from "@/lib/sportImages";
import { SETUP_SPORTS } from "@/lib/sports";
import * as storage from "@/lib/storage";
import { color, layout, radius, space, type } from "@/lib/tokens";
import { dur, ease } from "@/theme/animations";
import { themed, useGradients, usePalette, useThemedStyles } from "@/theme/runtime";

const PHOTO = require("@/assets/images/onboarding/welcome.jpg");
const MARK = require("@/assets/images/splash-icon.png");

const STEPS = ["welcome", "why", "sports", "notifications", "done"] as const;
type Step = (typeof STEPS)[number];

/**
 * Dwell on the two screens that carry no CTA (source's AS 1 and AS 17) before advancing
 * themselves. Not a MOTION §1 duration — nothing animates for this long; it is a reading hold,
 * the same kind of local constant as SplashGate's 1200ms floor. Tapping anywhere skips it, so
 * the timer is a floor for someone reading, never a wait imposed on someone who isn't.
 */
const READ_MS = 2600;

/** First name only — "Hi Ananya Suresh," reads like a form letter. */
function firstName(name: string | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}

export default function AccountSetup() {
  const styles = useThemedStyles(sheets);
  const gradient = useGradients();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { begin: beginHandoff } = useHandoff();
  const { enablePush } = usePush();
  const { show } = useToast();
  const updateProfile = useUpdateProfile(user?.id ?? "");

  const [index, setIndex] = useState(0);
  const [sports, setSports] = useState<string[]>([]);
  /** The "Other" row: open once tapped, and it stays open — closing it would discard the typing. */
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const step: Step = STEPS[index];

  const reduced = useReducedMotion();
  const enter = useSharedValue(1);
  const progress = useSharedValue(1 / STEPS.length);

  useEffect(() => {
    progress.value = withTiming((index + 1) / STEPS.length, { duration: dur.base, easing: ease.exit });
    if (reduced) {
      enter.value = 1;
      return;
    }
    // Restart from just-off-screen on every step. Short travel (MOTION §2): this is one flow
    // changing its contents, not a screen push.
    enter.value = 0;
    enter.value = withTiming(1, { duration: dur.base, easing: ease.exit });
  }, [index, reduced, enter, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * STEP_SLIDE }],
  }));
  const railStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  /**
   * Android back steps WITHIN the flow, and is swallowed on the first screen. There is no screen
   * to go back to: signup was `replace`d on the way in, so an unhandled back would either drop
   * the user out of the app or pop them onto an auth screen they are already signed in past.
   * No-op on iOS, which has no hardware back and no swipe target here.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setIndex((i) => Math.max(0, i - 1));
      return true;
    });
    return () => sub.remove();
  }, []);

  /**
   * Leave for the app. The loader is raised first and lives above the navigator, so replacing the
   * route in the same handler is fine — the tabs mount behind it (see components/chrome/Handoff).
   */
  const finish = useCallback(() => {
    storage.set("gg.setupComplete", true);
    beginHandoff();
    router.replace("/home");
  }, [beginHandoff, router]);

  const next = useCallback(() => {
    if (index === STEPS.length - 1) return finish();
    setIndex((i) => i + 1);
  }, [index, finish]);

  // The two CTA-less screens advance themselves; a tap anywhere gets there sooner.
  const selfAdvancing = step === "welcome" || step === "done";
  useEffect(() => {
    if (!selfAdvancing) return;
    const timer = setTimeout(next, READ_MS);
    return () => clearTimeout(timer);
  }, [selfAdvancing, next]);

  const toggleSport = (s: string) => {
    haptics.selection();
    setSports((current) => (current.includes(s) ? current.filter((x) => x !== s) : [...current, s]));
  };

  /**
   * The typed "Other" sport, normalised and folded into the answer.
   *
   * Title-cased because the rest of the field is: the web `/games` sport filter is case-sensitive
   * (see api/games.ts), so a lowercase "frisbee" saved here would not match the same sport
   * anywhere else in the app. Dropped when it duplicates a row the user could have tapped.
   */
  const otherSport = (() => {
    const clean = other.trim().replace(/\s+/g, " ");
    if (!clean) return null;
    const cased = clean.replace(/\b\w/g, (c) => c.toUpperCase());
    const dupe = sports.some((s) => s.toLowerCase() === cased.toLowerCase());
    return dupe ? null : cased;
  })();

  const answered = sports.length > 0 || otherSport !== null;

  /**
   * Save on the way out of the sports step, not on every tap — seven taps would be seven PATCHes
   * of the same field. Fire-and-forget by design: this flow is not a gate, so a failed save
   * costs a toast and the answer stays editable in profile edit. Skipping saves nothing at all,
   * which is the difference between "no answer" and "answered: none".
   */
  const commitSports = () => {
    if (!user?.id || !answered) return;
    updateProfile.mutate(
      { sports: otherSport ? [...sports, otherSport] : sports },
      {
        onError: () =>
          show({
            title: "Couldn't save your sports",
            body: "You can pick them any time from your profile.",
          }),
      },
    );
  };

  const onNotifications = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    // The outcome does not branch the flow: granted or denied, the next screen is the same one.
    // Settings owns it from here, and a denial is not an error to report back.
    await enablePush().catch(() => false);
    setPushBusy(false);
    next();
  };

  return (
    <View style={styles.field}>
      {/* The app-wide bar is dark-on-white (Decision 20); this screen is the exception. */}
      <StatusBar style="light" />

      {/* Full-bleed behind EVERYTHING on the "why" step — rail and pill float over the photo, as
          in the source. Inside the panel it would have stopped short of both. */}
      {step === "why" && (
        <>
          <Image source={PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={gradient.welcomeScrim.colors}
            locations={gradient.welcomeScrim.locations}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      )}

      {/* Source AS 1 carries no rail — the welcome is a moment, not step one of a form. */}
      <View style={[styles.railWrap, { marginTop: insets.top + space(2) }]}>
        {step !== "welcome" && (
          <View style={styles.railTrack}>
            <Animated.View
              style={[styles.railFill, railStyle]}
              accessibilityRole="progressbar"
              accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}
            />
          </View>
        )}
      </View>

      <Animated.View style={[styles.panel, panelStyle]}>
        {step === "welcome" && (
          <Press
            testID="setup-welcome"
            accessibilityRole="button"
            accessibilityLabel="Continue"
            tilt={false}
            onPress={next}
            style={styles.welcome}
          >
            <Image source={MARK} style={styles.mark} contentFit="contain" />
            <Text style={styles.welcomeCopy}>
              Hi {firstName(user?.name)},{"\n"}Welcome to GameGround.{"\n"}Thanks for becoming a
              member!
            </Text>
          </Press>
        )}

        {step === "why" && (
          <View style={styles.fill}>
            <Text style={styles.title}>
              To personalise your experience and connect you to sport, we&apos;ve got a few
              questions for you.
            </Text>
          </View>
        )}

        {step === "sports" && (
          <View style={styles.fill}>
            <Text style={styles.title}>What sports are you interested in?</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              // The Other row opens an input; a tap on the pill while it holds focus must land on
              // the pill, not be eaten dismissing the keyboard.
              keyboardShouldPersistTaps="handled"
            >
              {SETUP_SPORTS.map((s) => (
                <ChoiceRow key={s} label={s} selected={sports.includes(s)} onPress={() => toggleSport(s)} />
              ))}
              <OtherRow
                open={otherOpen}
                value={other}
                filled={otherSport !== null}
                onOpen={() => {
                  haptics.selection();
                  setOtherOpen(true);
                }}
                onChange={setOther}
              />
            </ScrollView>
          </View>
        )}

        {step === "notifications" && (
          <View style={styles.fill}>
            <Text style={styles.title}>
              Stay in the know with notifications about games near you, waitlist spots opening, and
              your payment confirmations.
            </Text>
          </View>
        )}

        {step === "done" && (
          <Press
            testID="setup-done"
            accessibilityRole="button"
            accessibilityLabel="Continue"
            tilt={false}
            onPress={next}
            style={styles.fill}
          >
            <Text style={styles.title}>
              You&apos;re in. You&apos;re now part of a growing community of players building the
              game in Kozhikode. Together.
            </Text>
          </Press>
        )}
      </Animated.View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space(4) }]}>
        {/* Source AS 7/8: one pill, two states — grey "Skip" until an answer exists, then a white
            "Next". The escape is the same control as the commitment, which is why neither screen
            in the reference carries a separate skip link. */}
        {step === "why" && <Pill testID="setup-primary" label="Get started" onPress={next} />}

        {step === "sports" && (
          <Pill
            testID="setup-primary"
            label={answered ? "Next" : "Skip"}
            muted={!answered}
            onPress={() => {
              commitSports();
              next();
            }}
          />
        )}

        {step === "notifications" && (
          <>
            <Pill testID="setup-primary" label="Next" busy={pushBusy} onPress={onNotifications} />
            {/* Not in the source, and required here: its AS 10 escape is the OS dialog's own
                "Don't Allow", which nothing on our side can offer and Maestro cannot drive. */}
            <Press
              testID="setup-skip"
              accessibilityRole="button"
              tilt={false}
              onPress={next}
              style={styles.notNow}
            >
              <Text style={styles.notNowText}>Not now</Text>
            </Press>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * The inverted CTA — DESIGN_SYSTEM §4 "Inverted CTA (photographic surfaces)". A white pill with
 * black copy, because DS §4's primary is a BLACK pill since Decision 20 and would vanish here.
 *
 * Screen-local, like onboarding's twin: two call sites, no spec, no catalog entry. A third
 * consumer is the point at which this earns a §10 spec instead of a third copy.
 */
function Pill({
  label,
  onPress,
  muted = false,
  busy = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** The "nothing selected yet" state — present, legible, visibly not the commitment. */
  muted?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  const styles = useThemedStyles(sheets);
  return (
    <Press
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      tilt={false}
      onPress={busy ? () => {} : onPress}
      style={[styles.pill, muted && styles.pillMuted]}
    >
      <Text style={[styles.pillLabel, muted && styles.pillLabelMuted]}>{label}</Text>
    </Press>
  );
}

/**
 * Screen-local, like onboarding's `Pill`: a selectable row with a sport backdrop and a check.
 * Not a DS component — one flow uses it, and §10 asks for composition before invention. If a
 * second screen ever needs it, that is the moment it earns a spec.
 */
function ChoiceRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  return (
    <Press
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      tilt={false}
      onPress={onPress}
      style={styles.row}
    >
      <Avatar name={label} uri={sportImage(label)} size={40} />
      <Text style={[styles.rowLabel, selected && styles.rowLabelOn]}>{label}</Text>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected && <CheckIcon size={13} color={color.onInverse} />}
      </View>
      <View style={styles.divider} />
    </Press>
  );
}

/**
 * The last row of the sports list: "Other", which opens into a field the user types their own
 * sport into. Six rows cannot cover a city's sports, and a list that silently omits yours reads
 * as "not for you" — the free-text row is what keeps the question answerable by everyone.
 *
 * Free text is safe to send: `sports` is already free text server-side (games and coaches carry
 * labels like "BOXING/KICK"), and `sportImage()` falls back to a generic backdrop for anything it
 * cannot match. It is normalised in `otherSport` before it is saved, never here — mangling
 * characters as they are typed is how a field fights its user.
 */
function OtherRow({
  open,
  value,
  filled,
  onOpen,
  onChange,
}: {
  open: boolean;
  value: string;
  /** Whether what's typed will actually be saved — blank and duplicate entries won't. */
  filled: boolean;
  onOpen: () => void;
  onChange: (v: string) => void;
}) {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  if (!open) {
    return (
      <Press accessibilityRole="button" accessibilityLabel="Other sport" tilt={false} onPress={onOpen} style={styles.row}>
        <Avatar name="Other" uri={sportImage(null)} size={40} />
        <Text style={styles.rowLabel}>Other</Text>
        <View style={styles.check}>
          <PlusIcon size={13} color={color.inverse} />
        </View>
        <View style={styles.divider} />
      </Press>
    );
  }
  return (
    <View style={styles.row}>
      <Avatar name="Other" uri={sportImage(value)} size={40} />
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChange}
        placeholder="Type your sport"
        placeholderTextColor={color.inverseBorder}
        // A sport name, not a sentence: the length cap is what stops this field being used as one.
        maxLength={28}
        returnKeyType="done"
        autoCapitalize="words"
        autoCorrect={false}
        selectionColor={color.inverse}
        style={styles.otherInput}
        accessibilityLabel="Your sport"
      />
      <View style={[styles.check, filled && styles.checkOn]}>
        {filled && <CheckIcon size={13} color={color.onInverse} />}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

/** MOTION §2 — a step change inside one flow, not a screen push. Short travel on purpose. */
const STEP_SLIDE = 28;

const sheets = themed(() => ({
  /** `onInverse` is the token for true black — the splash and loader field, not `color.bg`. */
  field: { flex: 1, backgroundColor: color.onInverse },
  fill: { flex: 1 },
  panel: { flex: 1 },

  railWrap: { height: 3, marginHorizontal: layout.screenX, marginBottom: space(6) },
  railTrack: { flex: 1, borderRadius: radius.chip, backgroundColor: color.inverse, opacity: 0.25 },
  railFill: { height: "100%", borderRadius: radius.chip, backgroundColor: color.inverse },

  /**
   * Source AS 1: mark and copy sit on the lower-left third, not centred and not at the top. The
   * emptiness above them is the composition — it is what makes the screen read as a pause.
   */
  welcome: { flex: 1, justifyContent: "center", paddingHorizontal: layout.screenX },
  // 4:3, matching the artwork's alpha bbox — the height moves with the width or the mark
  // distorts. Larger than the loader's 64×48: there it shares the frame with a 108pt ring, here
  // it is the only thing above the copy.
  mark: { width: 96, height: 72, marginBottom: space(5) },
  welcomeCopy: { ...type.title2, color: color.inverse, lineHeight: 24 },

  title: {
    ...type.authTitle,
    color: color.inverse,
    paddingHorizontal: layout.screenX,
    marginBottom: space(6),
  },
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(4) },
  row: { flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(3) },
  rowLabel: { ...type.title2, color: color.inverse, opacity: 0.7, flex: 1 },
  rowLabelOn: { opacity: 1 },
  // Sits in the row exactly where a label does, so opening the field doesn't reflow the list.
  otherInput: { ...type.title2, color: color.inverse, flex: 1, padding: 0 },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: color.inverseBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: color.inverse, borderColor: color.inverse },
  // A hairline at 55% white would be a rule; the source's is barely there. Opacity, so the
  // colour stays a token.
  divider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.inverse,
    opacity: 0.18,
  },

  actions: { alignItems: "center", gap: space(2), paddingHorizontal: layout.screenX },
  pill: {
    minWidth: 168,
    paddingVertical: space(3),
    paddingHorizontal: space(8),
    borderRadius: radius.chip,
    backgroundColor: color.inverse,
    alignItems: "center",
  },
  pillMuted: { backgroundColor: color.inverse, opacity: 0.22 },
  pillLabel: { ...type.bodyStrong, color: color.onInverse },
  pillLabelMuted: { color: color.inverse },
  notNow: { paddingVertical: space(2), paddingHorizontal: space(4) },
  notNowText: { ...type.bodyStrong, color: color.inverse, opacity: 0.7 },
}));
