import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { privateDownloadUrl } from "@/lib/storage";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: NextRequest, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const doc = await db.document.findUnique({ where: { id }, include: { application: { include: { tasks: { select: { assigneeId: true } } } }, legalCase: true } });
    if (!doc) throw new Error("Not found");
    if (user.role === "CLIENT" && (doc.application?.clientId !== user.id && doc.legalCase?.clientId !== user.id || !(doc.clientVisible === true || doc.uploaderId === user.id))) throw new Error("Access denied");
    if (user.role === "TEAM" && !doc.application?.tasks.some((t: { assigneeId: string }) => t.assigneeId === user.id) && doc.legalCase?.advocateId !== user.id) throw new Error("Access denied");
    await db.auditLog.create({ data: { actorId: user.id, action: "DOWNLOAD", entity: "Document", entityId: id } });
    return NextResponse.json({ url: await privateDownloadUrl(doc.storageKey) });
  } catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
}
