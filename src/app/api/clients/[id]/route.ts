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
    const input = z.object({ active: z.boolean().optional(), name: z.string().min(2).optional(), phone: z.string().max(30).nullable().optional() }).parse(await request.json());
    const client = await getUser(id);
    if (!client || client.role !== "CLIENT") throw new Error("Client not found");
    if (input.active !== undefined) {
      await firebaseAuth().updateUser(id, { disabled: !input.active });
      if (!input.active) await firebaseAuth().revokeRefreshTokens(id);
    }
    if (input.name) await firebaseAuth().updateUser(id, { displayName: input.name });
    await firestore().collection("users").doc(id).update({ ...input, updatedAt: new Date() });
    await firestore().collection("auditLogs").add({ actorId: admin.id, action: "UPDATE_CLIENT", entity: "User", entityId: id, createdAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
