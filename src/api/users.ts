/** Users endpoints (§3.3). Profile read/edit + GDPR delete (rotates identifiers). */
import { api } from "./client";
import type { ActivityItem, UpdateProfileInput, UserProfile } from "./types";

export function profile(id: string): Promise<UserProfile> {
  return api.get<UserProfile>(`/users/${id}`);
}

export function activity(id: string): Promise<ActivityItem[]> {
  return api.get<ActivityItem[]>(`/users/${id}/activity`);
}

export function update(input: UpdateProfileInput): Promise<UserProfile> {
  return api.post<UserProfile>("/users/me", input);
}

/**
 * GDPR account deletion (§3.3 / product 6.6). Server rotates identifiers and blocks re-login;
 * the app must hard-logout after. Never auto-retried.
 */
export function deleteAccount(): Promise<{ deleted: true }> {
  return api.del<{ deleted: true }>("/users/me", { retry401: false });
}
