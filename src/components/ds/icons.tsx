import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

import { color, google, icon as iconSize } from "@/lib/tokens";

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
export const ShareIcon = make("share-2", iconSize.header);
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
export const UsersIcon = make("users");
export const EyeIcon = make("eye");
export const EyeOffIcon = make("eye-off");
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

/**
 * Brand glyphs for social sign-in. Not UI icons and not a second icon *family* — they're the
 * providers' own marks, drawn as SVG (Feather carries no brand logos), homed here so the "one
 * icon source" rule still holds. Google keeps its 4-color mark; Apple inherits `color`.
 */
export function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={google.blue}
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill={google.green}
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill={google.yellow}
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill={google.red}
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

export function AppleGlyph({ size = 18, color: tint = color.text }: { size?: number; color?: ColorValue }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={tint}>
      <Path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09z" />
      <Path d="M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

/** Trophy — the tier-up celebration glyph (Feather has no cup). Stroked, inherits `color`. */
export function TrophyIcon({ size = 24, color: tint = color.text }: { size?: number; color?: ColorValue }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tint}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <Path d="M4 22h16" />
      <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Svg>
  );
}
