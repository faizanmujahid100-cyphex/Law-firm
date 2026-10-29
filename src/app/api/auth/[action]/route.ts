import { NextRequest, NextResponse } from "next/server";
import { firebaseAuth, firestore } from "@/lib/firebase/admin";
import { createSession, currentUser, endSession } from "@/lib/auth";
import { clientIp, rateLimit, verifyOrigin } from "@/lib/security";
import { signupSchema } from "@/lib/validation";
import { z } from "zod";
import { isDemoMode } from "@/lib/demo-config";

type Context = { params: Promise<{ action: string }> };
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest, { params }: Context) {
  try {
    await verifyOrigin();
    const { action } = await params;
    const body = await request.json();
    const ip = await clientIp();
    if (action === "register") {
      await rateLimit(`register:${ip}`, 8, 60);
      const input = z.object({ idToken: z.string(), name: signupSchema.shape.name, phone: z.string().max(30).optional() }).parse(body);
      const decoded = await firebaseAuth().verifyIdToken(input.idToken, true);
      if (!decoded.email) return fail("Email account required");
      const ref = firestore().collection("users").doc(decoded.uid);
      const existing = await ref.get();
      if (existing.exists && existing.get("role") !== "CLIENT") return fail("Account already managed by the office", 403);
      if (!existing.exists) await ref.create({ email: decoded.email.toLowerCase(), name: input.name, phone: input.phone ?? null, role: "CLIENT", active: true, createdAt: new Date(), updatedAt: new Date() });
      await firebaseAuth().setCustomUserClaims(decoded.uid, { role: "CLIENT" });
      await firestore().collection("auditLogs").add({ actorId: decoded.uid, action: "REGISTER", entity: "User", entityId: decoded.uid, createdAt: new Date() });
      return NextResponse.json({ ok: true, verificationRequired: !decoded.email_verified });
    }
    if (action === "session") {
      await rateLimit(`session:${ip}`, 20, 15);
      const idToken = z.string().parse(body.idToken);
      const user = await createSession(idToken);
      return NextResponse.json({ ok: true, role: user.role });
    }
    if (action === "logout") { await endSession(); return NextResponse.json({ ok: true }); }
    if (action === "profile") {
      const user = await currentUser();
      if (!user) return fail("Access denied", 403);
      const name = signupSchema.shape.name.parse(body.name);
      const phone = typeof body.phone === "string" ? body.phone.slice(0, 30) : null;
      if (name !== user.name && !isDemoMode()) {
        const recent = await firebaseAuth().verifyIdToken(z.string().parse(body.idToken), true);
        if (recent.uid !== user.id || Date.now() / 1000 - recent.auth_time > 300) return fail("Recent sign in required to change legal name", 403);
        await firebaseAuth().updateUser(user.id, { displayName: name });
      }
      await firestore().collection("users").doc(user.id).update({ name, phone, updatedAt: new Date() });
      await firestore().collection("auditLogs").add({ actorId: user.id, action: "UPDATE_PROFILE", entity: "User", entityId: user.id, createdAt: new Date() });
      return NextResponse.json({ ok: true });
    }
    return fail("Not found", 404);
  } catch (error) { return fail(error instanceof Error ? error.message : "Request failed", 400); }
}
