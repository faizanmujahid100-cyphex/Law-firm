import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-config";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoFirestore } from "@/lib/demo-store";

export async function GET(request: NextRequest) {
  if (!isDemoMode()) return new NextResponse(null, { status: 404 });
  try {
    const user = await requireUser();
    const key = request.nextUrl.searchParams.get("key");
    if (!key) throw new Error("Not found");
    const doc = await db.document.findUnique({ where: { storageKey: key }, include: { application: { include: { tasks: true } }, legalCase: true } });
    if (!doc) throw new Error("Not found");
    if (user.role === "CLIENT" && ((doc.application?.clientId !== user.id && doc.legalCase?.clientId !== user.id) || (!doc.clientVisible && doc.uploaderId !== user.id))) throw new Error("Access denied");
    if (user.role === "TEAM" && !doc.application?.tasks.some((t: { assigneeId: string }) => t.assigneeId === user.id) && doc.legalCase?.advocateId !== user.id) throw new Error("Access denied");
    const file = await demoFirestore.collection("demoFiles").doc(key).get();
    const bytes = file.exists ? Buffer.from(file.get("content"), "base64") : Buffer.from("AMANAH LEGAL — SAMPLE DOCUMENT\n\nFictional supporting document for the proposal demonstration. No real personal information is included.\n");
    return new NextResponse(bytes, { headers: { "Content-Type": file.exists ? file.get("mimeType") : "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="sample-document"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new NextResponse("Access denied", { status: 403 }); }
}
