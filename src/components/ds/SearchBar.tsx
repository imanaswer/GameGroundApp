/** DESIGN_SYSTEM.md §4 SearchBar. Input variant with leading search icon, radius 16. */
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { SearchIcon } from "@/components/ds/icons";
import { color, space, type } from "@/lib/tokens";

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
  ...rest
}: TextInputProps) {
  return (
    <View style={styles.wrap}>
      <SearchIcon color={color.dim} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.dim2}
        returnKeyType="search"
        style={styles.input}
        {...rest}
      />
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
  input: { flex: 1, color: color.text, fontFamily: type.body.fontFamily, fontSize: 13.5, paddingVertical: space(3) },
});
