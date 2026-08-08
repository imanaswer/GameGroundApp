/**
 * The single wrapper around `expo-image-picker`.
 *
 * Kept out of screens for the same reason `storage.ts` is: the permission dance and the "user
 * tapped cancel" case are easy to get subtly wrong, and a screen that improvises them ends up
 * treating a cancel as a failure and showing an error for something the user chose to do.
 *
 * Returns a discriminated result rather than throwing. Only one of these four is an actual
 * problem worth an error message — the other three are ordinary outcomes a caller must branch on.
 */
import * as ImagePicker from "expo-image-picker";

import { MAX_UPLOAD_BYTES, type LocalImage } from "@/api/upload";

export type PickResult =
  | { kind: "picked"; image: LocalImage }
  /** The user backed out of the system sheet. Never surface anything for this. */
  | { kind: "cancelled" }
  /** Permission refused. `canAskAgain: false` means only Settings can undo it. */
  | { kind: "denied"; canAskAgain: boolean }
  /** Caught locally so a doomed multi-megabyte upload is never started. */
  | { kind: "too-large"; bytes: number };

/**
 * Pick one image from the library, sized for upload.
 *
 * `quality: 0.8` and `allowsEditing` are deliberate for the QR case: a QR photographed at full
 * resolution is often over the server's 5 MB ceiling, and the crop step lets a host trim a
 * screenshot down to the code itself. 0.8 is well above the point where a QR stops scanning —
 * these are high-contrast square patterns, not photographs.
 *
 * Permission is requested up front rather than inferred from a failed launch. On iOS this costs
 * one system prompt the user already expects from tapping "upload a photo"; the alternative
 * (launch, catch, request, relaunch) shows the sheet twice on the unhappy path.
 */
export async function pickImage(): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { kind: "denied", canAskAgain: perm.canAskAgain };

  const res = await ImagePicker.launchImageLibraryAsync({
    // Array form, not the deprecated `MediaTypeOptions` enum.
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.8,
  });
  if (res.canceled) return { kind: "cancelled" };

  const asset = res.assets[0];
  if (!asset) return { kind: "cancelled" };

  // `fileSize` is not guaranteed on every platform/asset. When it's absent, let the upload
  // proceed — the server's own 413 is the authority, and refusing to try would block a
  // perfectly valid image on a missing field.
  if (typeof asset.fileSize === "number" && asset.fileSize > MAX_UPLOAD_BYTES) {
    return { kind: "too-large", bytes: asset.fileSize };
  }

  return {
    kind: "picked",
    image: { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType },
  };
}
