import "server-only";
import { storageBucket } from "@/lib/firebase/admin";

export async function uploadPrivate(key: string, content: Uint8Array, mimeType: string) {
  await storageBucket().file(key).save(Buffer.from(content), { resumable: false, contentType: mimeType, metadata: { cacheControl: "private, max-age=0" } });
}

export async function privateDownloadUrl(key: string) {
  const [url] = await storageBucket().file(key).getSignedUrl({ action: "read", expires: Date.now() + 60_000, version: "v4" });
  return url;
}
