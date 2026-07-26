/**
 * The registration engine's entity registry (M9, §9.1). Each registerable entity is ONE
 * config entry: its label, its list/detail API, and its registration field spec. A field
 * spec drives BOTH the zod schema and the rendered form — so adding a hypothetical fourth
 * entity is a single entry here, with zero new screens or payment code (M9 exit criterion).
 */
import * as campsApi from "@/api/camps";
import * as eventsApi from "@/api/events";
import * as workshopsApi from "@/api/workshops";
import type { EntityType, RegisterableKind } from "@/api/types";

export type Field =
  | { key: string; label: string; type: "text"; required?: boolean; placeholder?: string }
  | { key: string; label: string; type: "number"; required?: boolean; min?: number; max?: number }
  | { key: string; label: string; type: "select"; required?: boolean; options: string[] };

export type EntityConfig = {
  kind: RegisterableKind;
  /** The payment entityType (§9.1) — same value for camp/workshop/event. */
  entityType: EntityType;
  label: string;
  pluralLabel: string;
  list: (params?: { q?: string }) => ReturnType<typeof campsApi.list>;
  detail: (id: string) => ReturnType<typeof campsApi.detail>;
  /** registration payload fields, mirrored from the web verify Body (§9.1). */
  fields: Field[];
};

export const ENTITIES: Record<RegisterableKind, EntityConfig> = {
  camp: {
    kind: "camp",
    entityType: "camp",
    label: "Camp",
    pluralLabel: "Camps",
    list: campsApi.list,
    detail: campsApi.detail,
    fields: [
      { key: "childName", label: "Child’s name", type: "text", required: true, placeholder: "Full name" },
      { key: "childAge", label: "Child’s age", type: "number", required: true, min: 3, max: 18 },
      { key: "phone", label: "Contact number", type: "text", required: true, placeholder: "10-digit mobile" },
    ],
  },
  workshop: {
    kind: "workshop",
    entityType: "workshop",
    label: "Workshop",
    pluralLabel: "Workshops",
    list: workshopsApi.list,
    detail: workshopsApi.detail,
    fields: [
      { key: "participantName", label: "Participant name", type: "text", required: true, placeholder: "Full name" },
      { key: "participantAge", label: "Age", type: "number", required: true, min: 5, max: 99 },
      { key: "registrationType", label: "Registering as", type: "select", required: true, options: ["Individual", "Team"] },
    ],
  },
  event: {
    kind: "event",
    entityType: "event",
    label: "Event",
    pluralLabel: "Events",
    list: eventsApi.list,
    detail: eventsApi.detail,
    fields: [
      { key: "teamName", label: "Team name", type: "text", required: true, placeholder: "Your team" },
      { key: "phone", label: "Contact number", type: "text", required: true, placeholder: "10-digit mobile" },
      { key: "note", label: "Anything we should know? (optional)", type: "text", placeholder: "Optional" },
    ],
  },
};
