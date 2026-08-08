/**
 * Multipart uploads through the one allowed fetch site (`src/api/client.ts`).
 *
 * The two failure modes this locks down are both silent — the request goes out and the server
 * rejects it for a reason that looks nothing like the cause:
 *
 *   1. `JSON.stringify(formData)` returns `"{}"`, so a stringified upload arrives as an empty
 *      object and the server answers "No file provided".
 *   2. Setting `Content-Type: multipart/form-data` by hand omits the `boundary=` parameter that
 *      only fetch can generate, and the server's `req.formData()` throws on a body it can't split.
 */
import { ApiClientError, api } from "@/api/client";
import { uploadErrorMessage, uploadImage } from "@/api/upload";

jest.mock("@/lib/env", () => ({
  env: {
    appEnv: "development",
    apiUrl: "https://api.test",
    razorpayKeyId: "",
    googleIosClientId: "",
    googleAndroidClientId: "",
    posthogKey: "",
    sentryDsn: null,
  },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0" } },
}));

jest.mock("@/lib/storage", () => ({
  get: jest.fn(async () => "token-1"),
  set: jest.fn(async () => {}),
  remove: jest.fn(async () => {}),
  clearAuth: jest.fn(async () => {}),
  deviceId: jest.fn(async () => "device-1"),
}));

const res = (status: number, body: unknown) =>
  ({
    status,
    headers: { get: () => null },
    json: async () => body,
  }) as unknown as Response;

const UPLOADED = {
  url: "https://res.cloudinary.com/gg/image/upload/qr.png",
  publicId: "u1_1_abcd",
  width: 512,
  height: 512,
  format: "png",
};

/**
 * React Native's `FormData` accepts `{ uri, name, type }` in place of a `File` and keeps the parts
 * on an internal `_parts` array. Neither behaviour exists in this test environment's FormData —
 * appending an object there stringifies it to "[object Object]", which would make the file part
 * unassertable. Recording the appends is the only way to check what the app actually sends, and
 * it keeps `body instanceof FormData` true inside the client because both sides see this class.
 */
type Part = [string, unknown];
class RecordingFormData {
  parts: Part[] = [];
  append(name: string, value: unknown) {
    this.parts.push([name, value]);
  }
  get(name: string) {
    return this.parts.find(([k]) => k === name)?.[1];
  }
}

/** The last `fetch` init, so each test can assert on how the request was actually shaped. */
function lastInit(): RequestInit {
  return (global.fetch as jest.Mock).mock.calls.at(-1)![1] as RequestInit;
}

const sentForm = () => lastInit().body as unknown as RecordingFormData;

beforeEach(() => {
  global.FormData = RecordingFormData as unknown as typeof FormData;
  global.fetch = jest.fn(async () => res(201, { ok: true, data: UPLOADED })) as unknown as typeof fetch;
});

describe("multipart request shaping", () => {
  test("a FormData body is passed through untouched, never stringified", async () => {
    await uploadImage({ uri: "file:///tmp/qr.jpg", fileName: "qr.jpg", mimeType: "image/png" }, "gameground/upi-qr");

    const init = lastInit();
    expect(init.body).toBeInstanceOf(FormData);
    // The exact regression: "{}" is what a stringified FormData looks like on the wire.
    expect(typeof init.body).not.toBe("string");
  });

  test("no Content-Type header, so fetch can supply the multipart boundary", async () => {
    await uploadImage({ uri: "file:///tmp/qr.jpg" }, "gameground/upi-qr");

    const headers = lastInit().headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    // The rest of the client's headers still apply to an upload.
    expect(headers["X-Client"]).toBe("mobile");
    expect(headers.Authorization).toBe("Bearer token-1");
  });

  test("JSON requests are unaffected — they still stringify and declare their type", async () => {
    await api.post("/games", { title: "Evening Baskets" });

    const init = lastInit();
    expect(init.body).toBe(JSON.stringify({ title: "Evening Baskets" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  test("the file part carries the picked uri and the QR folder", async () => {
    await uploadImage(
      { uri: "file:///tmp/qr.jpg", fileName: "my-qr.png", mimeType: "image/png" },
      "gameground/upi-qr",
    );

    const file = sentForm().get("file") as Record<string, string>;
    expect(file.uri).toBe("file:///tmp/qr.jpg");
    expect(file.name).toBe("my-qr.png");
    expect(file.type).toBe("image/png");
    expect(sentForm().get("folder")).toBe("gameground/upi-qr");
  });

  test("falls back when the picker omits metadata — never sends undefined", async () => {
    // `fileName`/`mimeType` are optional on an ImagePickerAsset. React Native's FormData would
    // serialize an undefined here as the literal string "undefined".
    await uploadImage({ uri: "file:///tmp/qr.jpg" }, "gameground/upi-qr");

    const file = sentForm().get("file") as Record<string, string>;
    expect(file.name).toBe("upload.jpg");
    expect(file.type).toBe("image/jpeg");
  });

  test("returns the unwrapped Cloudinary URL", async () => {
    await expect(uploadImage({ uri: "file:///tmp/qr.jpg" }, "gameground/upi-qr")).resolves.toEqual(
      UPLOADED,
    );
  });
});

describe("upload error messages", () => {
  test.each([
    [413, "That image is too large — pick one under 5 MB."],
    [415, "That file isn’t an image we can read. Try a JPG or PNG."],
    [429, "Too many uploads just now. Wait a moment and try again."],
  ])("%i is rewritten for the host", (status, expected) => {
    expect(uploadErrorMessage(new ApiClientError(status, "raw server text"))).toBe(expected);
  });

  test("503 points at the workaround rather than a dead end", () => {
    expect(uploadErrorMessage(new ApiClientError(503, "Image uploads are not configured"))).toContain(
      "UPI ID instead",
    );
  });

  test("anything else keeps the server's own wording", () => {
    expect(uploadErrorMessage(new ApiClientError(400, "No file provided"))).toBe("No file provided");
  });

  test("a non-ApiClientError still yields something sayable", () => {
    expect(uploadErrorMessage(new Error("boom"))).toBe("Couldn’t upload that image. Please try again.");
  });
});
