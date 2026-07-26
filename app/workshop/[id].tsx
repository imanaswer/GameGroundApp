import { useLocalSearchParams } from "expo-router";

import { ENTITIES, RegisterableDetailScreen } from "@/features/registration";

export default function WorkshopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RegisterableDetailScreen config={ENTITIES.workshop} id={id} />;
}
