import { useLocalSearchParams } from "expo-router";

import { ENTITIES, RegisterableDetailScreen } from "@/features/registration";

export default function CampDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RegisterableDetailScreen config={ENTITIES.camp} id={id} />;
}
