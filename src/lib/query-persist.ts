/**
 * React Query disk persistence (Developer PRD §6.1/§8.3). Cached lists/details render instantly
 * offline. This is one of two allowed AsyncStorage import sites (the other is the RQ cache itself);
 * tokens never enter the query cache — they live only in SecureStore (S1.1).
 *
 * maxAge 24h; buster = app version, so a shipped schema change self-heals the cache on update.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import Constants from "expo-constants";

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "gg.rq-cache",
});

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000, // 24h
  buster: Constants.expoConfig?.version ?? "0",
} as const;
