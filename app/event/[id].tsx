import { useLocalSearchParams } from "expo-router";

import { ENTITIES, RegisterableDetailScreen } from "@/features/registration";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RegisterableDetailScreen config={ENTITIES.event} id={id} />;
}
