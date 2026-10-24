import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { uploadPrivate } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    await verifyOrigin();
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    const applicationId = String(form.get("applicationId") || "");
    const category = String(form.get("category") || "Other").slice(0, 80);
    if (!(file instanceof File) || !applicationId) throw new Error("File and application are required");
    if (file.size > 10 * 1024 * 1024 || file.size < 1) throw new Error("File must be below 10 MB");
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) throw new Error("Only PDF, PNG and JPEG files are accepted");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid = file.type === "application/pdf" ? String.fromCharCode(...bytes.slice(0, 4)) === "%PDF" : file.type === "image/png" ? bytes.slice(0, 4).join(",") === "137,80,78,71" : bytes[0] === 255 && bytes[1] === 216;
    if (!valid) throw new Error("File content does not match its type");
    const app = await db.application.findUnique({ where: { id: applicationId }, include: { tasks: { select: { assigneeId: true } } } });
    if (!app || (user.role === "CLIENT" && app.clientId !== user.id) || (user.role === "TEAM" && !app.tasks.some(t => t.assigneeId === user.id))) throw new Error("Access denied");
    if (user.role === "CLIENT" && !["DRAFT", "DOCUMENTS_REQUIRED"].includes(app.status)) throw new Error("Document uploads are not open for this application");
    const key = `private/${applicationId}/${randomUUID()}`;
    await uploadPrivate(key, bytes, file.type);
    const document = await db.document.create({ data: { storageKey: key, filename: file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180), mimeType: file.type, size: file.size, category, uploaderId: user.id, applicationId, clientVisible: user.role === "CLIENT" } });
    await db.auditLog.create({ data: { actorId: user.id, action: "UPLOAD", entity: "Document", entityId: document.id } });
    return NextResponse.json(document, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 }); }
}
