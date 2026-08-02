/** DESIGN_SYSTEM.md §4 Input. Card bg, red focus ring, floating error line. Password fields get
 *  an inline show/hide (eye) toggle. Forwards a ref to the inner TextInput so forms can chain
 *  focus (email → password → submit) off the keyboard's return key. */
import { forwardRef, useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { color, radius, ramp, space, type } from "@/lib/tokens";

import { EyeIcon, EyeOffIcon } from "./icons";
import { Press } from "./Press";

type Props = TextInputProps & { label?: string; error?: string; hint?: string };

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, editable = true, secureTextEntry, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.field,
          focused && styles.focus,
          !!error && styles.error,
          !editable && styles.disabled,
        ]}
      >
        {!!label && (
          <Text style={[styles.label, !!error && styles.labelError]} pointerEvents="none">
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={color.dim2}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Reveal flips the mask; only password fields ever pass secureTextEntry.
          secureTextEntry={isPassword && !revealed}
          style={styles.input}
          {...rest}
        />
        {isPassword && (
          <Press
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            scaleTo={0.9}
            hitSlop={8}
            onPress={() => setRevealed((v) => !v)}
            style={styles.eye}
          >
            {revealed ? (
              <EyeOffIcon size={18} color={color.dim} />
            ) : (
              <EyeIcon size={18} color={color.dim} />
            )}
          </Press>
        )}
      </View>
      {error ? (
        <Text style={styles.errorLine}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintLine}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  /**
   * The source notches the label INTO the field's top border rather than stacking it above
   * (its Login 03 frame). Absolutely positioned with a `bg`-coloured backdrop so it masks the
   * hairline behind it — which is why the field fill must be `bg` and not the grey `card`: the
   * mask only disappears if the label's backdrop matches the page exactly.
   */
  label: {
    position: "absolute",
    top: -7,
    left: space(3),
    paddingHorizontal: space(1),
    backgroundColor: color.bg,
    ...type.caption,
    color: color.dim,
    zIndex: 1,
  },
  labelError: { color: ramp.error[600] },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.bg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border2,
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: color.text,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
  },
  focus: { borderColor: color.primary },
  // Error is the ERROR ramp, not `primarySoft`. The red* -> primary*/error* rename mapped
  // `redLight` to `primarySoft` mechanically, which was right for accents and wrong here: this
  // border and the message below it are the only signal a field failed validation, and grey does
  // not read as failure.
  error: { borderColor: ramp.error[500] },
  disabled: { opacity: 0.5 },
  eye: { paddingHorizontal: space(3.5), paddingVertical: space(2), alignItems: "center", justifyContent: "center" },
  errorLine: { ...type.caption, color: ramp.error[600], marginTop: space(1) },
  hintLine: { ...type.caption, color: color.dim2, marginTop: space(1) },
});
