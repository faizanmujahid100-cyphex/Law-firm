import "server-only";
import { storageBucket } from "@/lib/firebase/admin";
import { isDemoMode } from "@/lib/demo-config";
import { demoFirestore } from "@/lib/demo-store";

export async function uploadPrivate(key: string, content: Uint8Array, mimeType: string) {
  if (isDemoMode()) {
    if (content.length > 1024 * 1024) throw new Error("Demo uploads are limited to 1 MB. Use a small sample file.");
    await demoFirestore.collection("demoFiles").doc(key).set({ content: Buffer.from(content).toString("base64"), mimeType });
    return;
  }
  await storageBucket().file(key).save(Buffer.from(content), { resumable: false, contentType: mimeType, metadata: { cacheControl: "private, max-age=0" } });
}

export async function privateDownloadUrl(key: string) {
  if (isDemoMode()) return `/api/demo-file?key=${encodeURIComponent(key)}`;
  const [url] = await storageBucket().file(key).getSignedUrl({ action: "read", expires: Date.now() + 60_000, version: "v4" });
  return url;
}
