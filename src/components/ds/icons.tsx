import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { color, icon as iconSize } from "@/lib/tokens";

/**
 * The single icon source (DS §3). No component may import an icon family directly.
 *
 * ponytail: Feather stands in for the kit's Lucide path set — same geometry family,
 * stroke 2, round caps. M3 swaps this file's internals for the kit's exported paths;
 * every call site keeps working because they only ever see the names below.
 */
type Props = {
  size?: number;
  color?: ColorValue;
} & Omit<ComponentProps<typeof Feather>, "name" | "size" | "color">;

function make(name: ComponentProps<typeof Feather>["name"], defaultSize: number = iconSize.meta) {
  function Icon({ size = defaultSize, color: tint = color.text, ...rest }: Props) {
    return <Feather name={name} size={size} color={tint} {...rest} />;
  }
  Icon.displayName = `Icon(${name})`;
  return Icon;
}

export const HomeIcon = make("home", iconSize.tab);
export const GamesIcon = make("zap", iconSize.tab);
export const CoachesIcon = make("users", iconSize.tab);
export const DiscoverIcon = make("compass", iconSize.tab);
export const LeadersIcon = make("award", iconSize.tab);
export const BackIcon = make("chevron-left", iconSize.header);
export const SearchIcon = make("search", iconSize.header);
