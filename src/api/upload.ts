/**
 * Image upload — `POST /upload` (web `src/app/api/upload/route.ts`).
 *
 * A general, authenticated, Cloudinary-backed endpoint: any signed-in user may call it, and the
 * server signs the upstream request itself so no Cloudinary credential ever reaches the app. It
 * returns a permanent `secure_url`, which is what gets stored on the record that referenced it —
 * the app uploads first and submits the resulting URL as an ordinary string field.
 *
 * Server-side limits, mirrored here only where the app can spare the user a wasted round-trip:
 *   - 5 MB ceiling (413)
 *   - jpeg / png / webp / gif, validated by MAGIC BYTES rather than the declared MIME type (415),
 *     so a mislabelled `type` below is caught by the server no matter what the picker claimed
 *   - rate-limited per user (429)
 *   - 503 when Cloudinary is unconfigured — an environment fault, not the user's
 */
import { ApiClientError, api } from "./client";

/** Cloudinary's response, unwrapped from the `{ ok, data }` envelope by the client. */
export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

/**
 * What a picker hands back. `expo-image-picker` returns exactly this shape (plus fields we don't
 * need), so the caller passes an asset through without reshaping it.
 */
export interface LocalImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

/** The server's ceiling, so an oversized pick fails instantly instead of after a long upload. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Uploads take far longer than the 15 s default — a QR photographed on a modern phone is a
 * multi-megabyte file on a mobile uplink, and the request also waits on the server's own hop to
 * Cloudinary. 60 s is generous enough that a slow-but-working connection is never cut off.
 */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * React Native's `FormData` accepts `{ uri, name, type }` in place of a `File` and streams the
 * local file itself — reading the bytes into JS first would double peak memory for no gain.
 *
 * `folder` is validated server-side against `^[a-z0-9_\-/]{1,48}$` and silently replaced with
 * `gameground/uploads` if it fails, so an unexpected value degrades rather than erroring.
 */
export async function uploadImage(image: LocalImage, folder: string): Promise<UploadedImage> {
  const form = new FormData();
  form.append("file", {
    uri: image.uri,
    // The server derives the real format from magic bytes, so these two are hints for
    // Cloudinary's stored filename rather than anything security-relevant.
    name: image.fileName || "upload.jpg",
    type: image.mimeType || "image/jpeg",
  } as unknown as Blob);
  form.append("folder", folder);

  return api.post<UploadedImage>("/upload", form, { timeoutMs: UPLOAD_TIMEOUT_MS });
}

/**
 * The upload failures a host can actually do something about, in their words rather than the
 * server's. Anything else keeps the server's message, which for this endpoint is already written
 * for a person ("File is not a valid image", "File exceeds 5MB limit").
 */
export function uploadErrorMessage(e: unknown): string {
  if (!(e instanceof ApiClientError)) return "Couldn’t upload that image. Please try again.";
  if (e.status === 413) return "That image is too large — pick one under 5 MB.";
  if (e.status === 415) return "That file isn’t an image we can read. Try a JPG or PNG.";
  if (e.status === 429) return "Too many uploads just now. Wait a moment and try again.";
  if (e.status === 503) return "Image uploads are unavailable right now. You can add a UPI ID instead.";
  return e.message || "Couldn’t upload that image. Please try again.";
}
