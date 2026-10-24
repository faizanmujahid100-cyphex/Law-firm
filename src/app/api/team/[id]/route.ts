import { NextRequest, NextResponse } from "next/server";
import { firebaseAuth, firestore } from "@/lib/firebase/admin";
import { getUser, requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { z } from "zod";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    await verifyOrigin();
    const admin = await requireUser(["ADMIN"]);
    const { id } = await params;
    const input = z.object({ active: z.boolean().optional(), title: z.string().optional(), permissions: z.array(z.string()).optional(), publicApproved: z.boolean().optional(), bio: z.string().optional(), qualifications: z.string().optional(), practiceAreas: z.array(z.string()).optional() }).parse(await request.json());
    const member = await getUser(id);
    if (!member || member.role !== "TEAM") throw new Error("Team member not found");
    if (input.active !== undefined) {
      await firebaseAuth().updateUser(id, { disabled: !input.active });
      if (!input.active) await firebaseAuth().revokeRefreshTokens(id);
    }
    const { active, ...profile } = input;
    await firestore().collection("users").doc(id).update({ ...(active !== undefined ? { active } : {}), teamProfile: { ...member.teamProfile, ...profile }, updatedAt: new Date() });
    await firestore().collection("auditLogs").add({ actorId: admin.id, action: "UPDATE_TEAM_MEMBER", entity: "User", entityId: id, createdAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
