import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { fieldSchema, validateApplication } from "@/lib/validation";
import { z } from "zod";
import { protectData, revealData } from "@/lib/sensitive-data";
type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const app = await db.application.findUnique({ where: { id }, include: { service: true, version: true, client: { select: { id: true, name: true, email: true } }, history: { orderBy: { createdAt: "asc" } }, notes: { orderBy: { createdAt: "desc" } }, documents: true, tasks: true, invoices: { include: { payments: true } } } });
    if (!app || (user.role === "CLIENT" && app.clientId !== user.id) || (user.role === "TEAM" && !app.tasks.some(t => t.assigneeId === user.id))) throw new Error("Access denied");
    if (user.role === "CLIENT") return NextResponse.json({ ...app, data: revealData(app.data), notes: app.notes.filter(n => n.clientVisible), history: app.history.filter(h => h.clientVisible), documents: app.documents.filter(d => d.clientVisible === true || d.uploaderId === user.id), tasks: [] });
    if (user.role === "TEAM") return NextResponse.json({ ...app, data: revealData(app.data), invoices: [], tasks: app.tasks.filter(t => t.assigneeId === user.id) });
    return NextResponse.json({ ...app, data: revealData(app.data) });
  } catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    await verifyOrigin();
    const user = await requireUser();
    const { id } = await params;
    const body = z.object({ status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "DOCUMENTS_REQUIRED", "APPROVED", "IN_PROGRESS", "AWAITING_REVIEW", "COMPLETED", "REJECTED", "CANCELLED"]).optional(), data: z.record(z.string(), z.unknown()).optional(), note: z.string().max(2000).optional(), clientVisible: z.boolean().default(true) }).parse(await request.json());
    const app = await db.application.findUniqueOrThrow({ where: { id }, include: { version: true } });
    if (user.role === "CLIENT" && (app.clientId !== user.id || !["DRAFT", "DOCUMENTS_REQUIRED"].includes(app.status))) throw new Error("Access denied");
    if (user.role === "TEAM") throw new Error("Access denied");
    if (user.role === "CLIENT" && body.status && !["SUBMITTED"].includes(body.status)) throw new Error("Access denied");
    const workflow = z.array(z.string()).parse(app.version.workflow);
    if (body.status && !["DRAFT", "REJECTED", "CANCELLED"].includes(body.status) && !workflow.includes(body.status)) throw new Error("Status is outside this service workflow");
    const fields = z.array(fieldSchema).parse(app.version.form);
    const data = body.data ? validateApplication({ fields, documents: [] }, body.data) : null;
    if (body.status === "SUBMITTED") {
      const checked = data ?? validateApplication({ fields, documents: [] }, revealData(app.data));
      if (checked.errors.length) throw new Error(checked.errors.join("; "));
      const required = [...z.array(z.object({ key: z.string(), label: z.string(), required: z.boolean() })).parse(app.version.requirements), ...fields.filter(field => field.type === "file").map(field => ({ key: field.key, label: field.label, required: field.required }))].filter(doc => doc.required);
      const documents = await db.document.findMany({ where: { applicationId: id }, select: { category: true } });
      const missing = required.filter(doc => !documents.some(file => file.category === doc.key));
      if (missing.length) throw new Error(`Missing required documents: ${missing.map(doc => doc.label).join(", ")}`);
    }
    if (body.status === "REJECTED" && !body.note?.trim()) throw new Error("A rejection reason is required");
    const result = await db.$transaction(async tx => {
      const updated = await tx.application.update({ where: { id }, data: { status: body.status, data: data ? protectData(data.data) : undefined, submittedAt: body.status === "SUBMITTED" ? new Date() : undefined } });
      if (body.status && body.status !== app.status) await tx.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: app.status, toStatus: body.status, actorId: user.id, note: body.note, clientVisible: body.clientVisible } });
      if (body.note) await tx.applicationNote.create({ data: { applicationId: id, authorId: user.id, body: body.note, clientVisible: body.clientVisible } });
      await tx.auditLog.create({ data: { actorId: user.id, action: body.status ? `STATUS_${body.status}` : "UPDATE", entity: "Application", entityId: id } });
      if (body.status && user.role === "ADMIN") await tx.notification.create({ data: { userId: app.clientId, title: "Application update", body: `${app.reference}: ${body.status.replaceAll("_", " ")}`, href: `/client/applications/${id}` } });
      return updated;
    });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
