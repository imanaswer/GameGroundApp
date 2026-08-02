/** DESIGN_SYSTEM.md §4 SearchBar. Input variant with leading search icon, radius 16, red focus
 *  ring, and a trailing clear (×) once there's a query. */
import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { CloseIcon, SearchIcon } from "@/components/ds/icons";
import { Press } from "@/components/ds/Press";
import { color, space, type } from "@/lib/tokens";

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
  ...rest
}: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, focused && styles.focus]}>
      <SearchIcon color={focused ? color.redLight : color.dim} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.dim2}
        returnKeyType="search"
        style={styles.input}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
      />
      {!!value && (
        <Press
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          scaleTo={0.9}
          hitSlop={8}
          onPress={() => onChangeText?.("")}
          style={styles.clear}
        >
          <CloseIcon size={16} color={color.dim} />
        </Press>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(2),
    backgroundColor: color.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space(3.5),
    minHeight: 44,
  },
  focus: { borderColor: color.redFocus },
  input: { flex: 1, color: color.text, fontFamily: type.body.fontFamily, fontSize: type.body.fontSize, paddingVertical: space(3) },
  clear: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
});
