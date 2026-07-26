/** DESIGN_SYSTEM.md §4 Input. Card bg, red focus ring, floating error line. */
import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { color, radius, space, type } from "@/lib/tokens";

type Props = TextInputProps & { label?: string; error?: string };

export function Input({ label, error, editable = true, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        editable={editable}
        placeholderTextColor={color.dim2}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          focused && styles.focus,
          !!error && styles.error,
          !editable && styles.disabled,
        ]}
        {...rest}
      />
      {!!error && <Text style={styles.errorLine}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  label: { ...type.label, color: color.dim, marginBottom: space(2) },
  input: {
    backgroundColor: color.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    color: color.text,
    fontFamily: type.body.fontFamily,
    fontSize: 13.5,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
    minHeight: 44,
  },
  focus: { borderColor: color.redFocus },
  error: { borderColor: color.redLight },
  disabled: { opacity: 0.5 },
  errorLine: { ...type.caption, color: color.redLight, marginTop: space(1) },
});
