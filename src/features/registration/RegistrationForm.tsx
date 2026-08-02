/**
 * The shared registration form (M9). Renders inputs from an entity's field spec, validates
 * with the spec-derived zod, then drives the M6 checkout — every entity, zero new payment
 * code (§9). Free entities register through the same path with a ₹0 confirm.
 */
import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import type { EntityType } from "@/api/types";
import { CheckoutSheet } from "@/components/checkout";
import { useToast } from "@/components/chrome";
import { Button, Chip, CloseIcon, Input, Press } from "@/components/ds";
import { useCheckout } from "@/hooks/useCheckout";
import { usePush } from "@/hooks/usePush";
import { formatAmount } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { color, layout, space, type } from "@/lib/tokens";

import type { EntityConfig } from "./entities";
import { useRegisterFree } from "./hooks";
import { schemaFromFields } from "./schema";

export function RegistrationForm({
  config,
  entityId,
  amountPaise,
  onClose,
}: {
  config: EntityConfig;
  entityId: string;
  amountPaise: number;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registration, setRegistration] = useState<Record<string, unknown> | null>(null);
  // `registration` is set the moment the form is submitted, which is exactly when this flow enters
  // the payment path — so it doubles as the FLAG_SECURE gate (§9.5). Before that the user is only
  // filling in a form and nothing sensitive is on screen.
  const checkout = useCheckout(
    config.entityType as EntityType,
    entityId,
    registration ?? {},
    registration !== null,
  );
  const { promptForPush } = usePush();
  const { show } = useToast();
  const isFree = amountPaise <= 0;
  const registerFree = useRegisterFree(config, entityId);

  // First successful registration → offer reminders (shown once, §10.2).
  useEffect(() => {
    if (checkout.state === "success") promptForPush();
  }, [checkout.state, promptForPush]);

  const set = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const onSupport = () => {
    const subject = encodeURIComponent(`Payment help — ${config.kind} ${entityId}`);
    Linking.openURL(`mailto:support@gameground.net?subject=${subject}`).catch(() => {});
  };

  const submit = () => {
    const parsed = schemaFromFields(config.fields).safeParse(values);
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) flat[String(issue.path[0])] = issue.message;
      setErrors(flat);
      return;
    }
    setErrors({});

    // Free entities take a different ENDPOINT, not a ₹0 checkout: the server's charge helpers
    // throw on a ₹0 amount, so the gateway is unreachable for them by design.
    if (isFree) {
      registerFree.mutate(parsed.data, {
        onSuccess: () => {
          haptics.success();
          promptForPush();
          show({ title: "You’re registered", body: `Your place in this ${config.label.toLowerCase()} is confirmed.` });
          onClose();
        },
        onError: (e: unknown) => show({ title: "Couldn’t register", body: (e as Error).message }),
      });
      return;
    }

    setRegistration(parsed.data);
    // Next frame the checkout hook has the registration payload; open the sheet.
    setTimeout(() => checkout.start(), 0);
  };

  // Once a payment is in flight or done, show the sheet instead of the form.
  if (registration && checkout.state !== "methods") {
    return (
      <View style={styles.sheetHost}>
        <CheckoutSheet
          state={checkout.state}
          phase={checkout.phase}
          error={checkout.error}
          amount={formatAmount(amountPaise)}
          onRetry={checkout.retry}
          onSupport={onSupport}
          onClose={onClose}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Register for this {config.label.toLowerCase()}</Text>
        <Press accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} scaleTo={0.9} hitSlop={8} style={styles.close}>
          <CloseIcon size={18} color={color.dim} />
        </Press>
      </View>
      {config.fields.map((f) =>
        f.type === "select" ? (
          <View key={f.key} style={styles.fieldWrap}>
            <Text style={styles.label}>{f.label}</Text>
            <View style={styles.chipRow}>
              {f.options.map((opt) => (
                <Chip key={opt} label={opt} active={values[f.key] === opt} onPress={() => set(f.key)(opt)} />
              ))}
            </View>
            {!!errors[f.key] && <Text style={styles.err}>{errors[f.key]}</Text>}
          </View>
        ) : (
          <Input
            key={f.key}
            testID={`registration-${f.key}`}
            label={f.label}
            value={values[f.key] ?? ""}
            onChangeText={set(f.key)}
            error={errors[f.key]}
            keyboardType={f.type === "number" ? "number-pad" : "default"}
            placeholder={f.type === "text" ? f.placeholder : undefined}
          />
        ),
      )}
      <Button
        testID="registration-submit"
        title={isFree ? "Confirm registration" : `Continue · ${formatAmount(amountPaise)}`}
        onPress={submit}
        loading={registerFree.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: layout.screenX, gap: space(1), paddingTop: space(2) },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space(3) },
  header: { ...type.heading, color: color.text, flex: 1 },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  fieldWrap: { marginBottom: space(4) },
  label: { ...type.label, color: color.dim, marginBottom: space(2) },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  err: { ...type.caption, color: color.redLight, marginTop: space(1) },
  sheetHost: { paddingBottom: space(4) },
});
