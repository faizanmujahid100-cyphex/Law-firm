import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { firebaseAuth, firestore } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    return NextResponse.json(await db.user.findMany({ where: { role: "TEAM" }, select: { id: true, name: true, email: true, active: true, teamProfile: true, _count: { select: { assignedTasks: true } } }, orderBy: { name: "asc" } }));
  } catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
}

export async function POST(request: NextRequest) {
  try {
    await verifyOrigin();
    const admin = await requireUser(["ADMIN"]);
    const input = z.object({ name: z.string().min(2), email: z.email(), title: z.string().min(2), permissions: z.array(z.enum(["tasks.claim", "applications.view", "cases.manage", "documents.upload"])).default([]), bio: z.string().optional(), qualifications: z.string().optional(), practiceAreas: z.array(z.string()).default([]), publicApproved: z.boolean().default(false) }).parse(await request.json());
    const temporaryPassword = randomBytes(24).toString("base64url");
    const member = await firebaseAuth().createUser({ email: input.email, password: temporaryPassword, displayName: input.name, emailVerified: true });
    try {
      await firebaseAuth().setCustomUserClaims(member.uid, { role: "TEAM" });
      await firestore().collection("users").doc(member.uid).create({ email: input.email.toLowerCase(), name: input.name, role: "TEAM", active: true, phone: null, createdAt: new Date(), updatedAt: new Date(), teamProfile: { title: input.title, permissions: input.permissions, bio: input.bio ?? "", qualifications: input.qualifications ?? "", practiceAreas: input.practiceAreas, publicApproved: input.publicApproved } });
    } catch (error) { await firebaseAuth().deleteUser(member.uid); throw error; }
    await firestore().collection("auditLogs").add({ actorId: admin.id, action: "CREATE_TEAM_MEMBER", entity: "User", entityId: member.uid, createdAt: new Date() });
    const sent = await firebaseAuth().generatePasswordResetLink(input.email).then(link => sendEmail(input.email, "Your team account", `Your team account is ready. Set your password: ${link}`)).catch(() => ({ sent: false as const }));
    return NextResponse.json({ id: member.uid, emailSent: sent.sent, temporaryPassword: sent.sent ? undefined : temporaryPassword }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
