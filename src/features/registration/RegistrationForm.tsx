/**
 * The shared registration form (M9). Renders inputs from an entity's field spec, validates
 * with the spec-derived zod, then drives the M6 checkout — every entity, zero new payment
 * code (§9). Free entities register through the same path with a ₹0 confirm.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { EntityType } from "@/api/types";
import { CheckoutSheet } from "@/components/checkout";
import { Button, Chip, Input, Press } from "@/components/ds";
import { useCheckout } from "@/hooks/useCheckout";
import { usePush } from "@/hooks/usePush";
import { formatAmount } from "@/lib/format";
import { color, layout, space, type } from "@/lib/tokens";

import type { EntityConfig } from "./entities";
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
  const checkout = useCheckout(config.entityType as EntityType, entityId, registration ?? {});
  const { promptForPush } = usePush();

  // First successful registration → offer reminders (shown once, §10.2).
  useEffect(() => {
    if (checkout.state === "success") promptForPush();
  }, [checkout.state, promptForPush]);

  const set = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = () => {
    const parsed = schemaFromFields(config.fields).safeParse(values);
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) flat[String(issue.path[0])] = issue.message;
      setErrors(flat);
      return;
    }
    setErrors({});
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
          onSupport={() => {}}
        />
        {checkout.state === "success" && (
          <Press onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </Press>
        )}
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.header}>Register for this {config.label.toLowerCase()}</Text>
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
            label={f.label}
            value={values[f.key] ?? ""}
            onChangeText={set(f.key)}
            error={errors[f.key]}
            keyboardType={f.type === "number" ? "number-pad" : "default"}
            placeholder={f.type === "text" ? f.placeholder : undefined}
          />
        ),
      )}
      <Button title={`Continue · ${formatAmount(amountPaise)}`} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: layout.screenX, gap: space(1), paddingTop: space(2) },
  header: { ...type.heading, fontSize: 16, color: color.text, marginBottom: space(3) },
  fieldWrap: { marginBottom: space(4) },
  label: { ...type.label, color: color.dim, marginBottom: space(2) },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  err: { ...type.caption, color: color.redLight, marginTop: space(1) },
  sheetHost: { paddingBottom: space(4) },
  done: { alignItems: "center", paddingVertical: space(4), backgroundColor: color.elev },
  doneText: { ...type.heading, color: color.text },
});
