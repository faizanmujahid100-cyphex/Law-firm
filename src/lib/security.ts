import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { firestore } from "@/lib/firebase/admin";

export async function verifyOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host && new URL(origin).host !== host) throw new Error("Invalid request origin");
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function rateLimit(key: string, limit: number, minutes: number) {
  const bucket = Math.floor(Date.now() / (minutes * 60_000));
  const id = createHash("sha256").update(`${key}:${bucket}`).digest("hex");
  const ref = firestore().collection("rateLimits").doc(id);
  await firestore().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number(snap.get("count")) : 0;
    if (count >= limit) throw new Error("Too many attempts. Please try again later.");
    tx.set(ref, { count: count + 1, expiresAt: new Date(Date.now() + minutes * 120_000) });
  });
}
