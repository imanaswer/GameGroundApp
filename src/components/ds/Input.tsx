/** DESIGN_SYSTEM.md §4 Input. Card bg, red focus ring, floating error line. Password fields get
 *  an inline show/hide (eye) toggle. Forwards a ref to the inner TextInput so forms can chain
 *  focus (email → password → submit) off the keyboard's return key. */
import { forwardRef, useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { color, radius, space, type } from "@/lib/tokens";

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
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.field,
          focused && styles.focus,
          !!error && styles.error,
          !editable && styles.disabled,
        ]}
      >
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
  label: { ...type.label, color: color.dim, marginBottom: space(2) },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    minHeight: 44,
  },
  input: {
    flex: 1,
    color: color.text,
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
  },
  focus: { borderColor: color.redFocus },
  error: { borderColor: color.redLight },
  disabled: { opacity: 0.5 },
  eye: { paddingHorizontal: space(3.5), paddingVertical: space(2), alignItems: "center", justifyContent: "center" },
  errorLine: { ...type.caption, color: color.redLight, marginTop: space(1) },
  hintLine: { ...type.caption, color: color.dim2, marginTop: space(1) },
});
