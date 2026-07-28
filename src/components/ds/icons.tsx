import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

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
export const ShareIcon = make("share", iconSize.header);
export const BellIcon = make("bell", iconSize.header);
export const MapPinIcon = make("map-pin");
export const CalendarIcon = make("calendar");
export const ClockIcon = make("clock");
export const StarIcon = make("star");
export const CheckIcon = make("check");
export const CloseIcon = make("x");
export const ChevronRightIcon = make("chevron-right");
export const ChevronDownIcon = make("chevron-down");
export const AlertIcon = make("alert-circle");
export const OfflineIcon = make("wifi-off");
export const PlusIcon = make("plus");
export const MessageIcon = make("message-circle");
export const CameraIcon = make("camera");
export const UserIcon = make("user");
export const SettingsIcon = make("settings");
export const CardIcon = make("credit-card");
export const LogOutIcon = make("log-out");
export const TrashIcon = make("trash-2");
export const InfoIcon = make("info");
export const FilterIcon = make("sliders");

/**
 * Podium crown (DS §8) — the one celebratory glyph Feather doesn't carry. Filled, gold by default;
 * a deliberate, documented exception to the single-family rule for the leaderboard #1 topper only.
 */
export function CrownIcon({ size = 18, color: tint = color.gold }: { size?: number; color?: ColorValue }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={tint}>
      <Path d="M3 18h18l-2-9-4.5 4L12 5l-2.5 8L5 9z" />
    </Svg>
  );
}
