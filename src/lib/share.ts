/**
 * Share sheet helper (Developer PRD §11 task 4). In-app shares always use the https web URL,
 * never the custom scheme — so a recipient without the app still lands on gameground.net (and
 * with the app installed, the universal link opens it directly).
 */
import { Share } from "react-native";

import { captureException } from "@/lib/sentry";

const WEB_PATH: Record<string, string> = {
  game: "games",
  coach: "coaches",
  camp: "camps",
  workshop: "workshops",
  event: "events",
};

const BASE = "https://www.gameground.net";

export function webUrlFor(kind: keyof typeof WEB_PATH | string, id: string): string {
  const path = WEB_PATH[kind] ?? kind;
  return `${BASE}/${path}/${id}`;
}

export async function shareEntity(kind: string, id: string, title: string): Promise<void> {
  const url = webUrlFor(kind, id);
  try {
    await Share.share({ message: `${title} — ${url}`, url, title });
  } catch (e) {
    captureException(e, { where: "shareEntity", kind });
  }
}
