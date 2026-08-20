/**
 * Image upload as a mutation, so screens compose it instead of calling the API directly.
 *
 * Nothing here touches the query cache: an upload creates a Cloudinary object that no query reads.
 * The URL it returns is form state until the record referencing it is submitted, and it's the
 * submit that invalidates.
 *
 * Not auto-retried. `POST /upload` is not idempotent — a retry after a dropped connection would
 * leave a second orphaned image on Cloudinary — and the caller is a person who can simply tap
 * again if it failed.
 */
import { useMutation } from "@tanstack/react-query";

import * as uploadApi from "@/api/upload";

export function useUploadImage() {
  return useMutation({
    mutationFn: ({ image, folder }: { image: uploadApi.LocalImage; folder: string }) =>
      uploadApi.uploadImage(image, folder),
    retry: false,
  });
}
