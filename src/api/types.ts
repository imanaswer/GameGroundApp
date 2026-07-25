/**
 * Response types mirrored from the web repo's route selects (Developer PRD §4.4).
 * When the web response shape changes, this file is the single place to update.
 */

/** JWT claims / `GET /auth/me` payload (web src/lib/auth.ts SessionUser). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  avatarUrl: string | null;
}

/** `POST /auth/login|register|google/mobile|apple/mobile` body. refreshToken arrives once M1 ships. */
export interface AuthPayload {
  user: SessionUser;
  token: string;
  refreshToken?: string;
}

/** `POST /auth/refresh` (Developer PRD §5.3). */
export interface RefreshPayload {
  token: string;
  refreshToken: string;
}
