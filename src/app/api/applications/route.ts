import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { fieldSchema, validateApplication } from "@/lib/validation";
import { z } from "zod";
import { protectData } from "@/lib/sensitive-data";

export async function GET() {
  try {
    const user = await requireUser();
    const where = user.role === "ADMIN" ? {} : user.role === "CLIENT" ? { clientId: user.id } : { tasks: { some: { assigneeId: user.id } } };
    return NextResponse.json(await db.application.findMany({ where, include: { service: { select: { title: true, slug: true } }, client: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }));
  } catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
}

export async function POST(request: NextRequest) {
  try {
    await verifyOrigin();
    const user = await requireUser(["CLIENT"]);
    const body = z.object({ serviceId: z.string(), data: z.record(z.string(), z.unknown()).default({}), submit: z.boolean().default(false) }).parse(await request.json());
    const service = await db.service.findUnique({ where: { id: body.serviceId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!service?.published || !service.versions[0]) throw new Error("Service unavailable");
    const fields = z.array(fieldSchema).parse(service.versions[0].form);
    const { data, errors } = validateApplication({ fields, documents: [] }, body.data);
    if (body.submit && errors.length) return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    const requiredDocs = [...z.array(z.object({ key: z.string(), label: z.string(), required: z.boolean() })).parse(service.versions[0].requirements), ...fields.filter(field => field.type === "file").map(field => ({ key: field.key, label: field.label, required: field.required }))].filter(doc => doc.required);
    if (body.submit && requiredDocs.length) return NextResponse.json({ error: "Save a draft and upload required documents before submitting." }, { status: 400 });
    const application = await db.$transaction(async tx => {
      const app = await tx.application.create({ data: { reference: `REQ-${randomUUID().slice(0, 8).toUpperCase()}`, clientId: user.id, serviceId: service.id, versionId: service.versions[0].id, data: protectData(data), status: body.submit ? "SUBMITTED" : "DRAFT", submittedAt: body.submit ? new Date() : null } });
      await tx.applicationStatusHistory.create({ data: { applicationId: app.id, actorId: user.id, toStatus: app.status } });
      await tx.auditLog.create({ data: { actorId: user.id, action: body.submit ? "SUBMIT" : "CREATE_DRAFT", entity: "Application", entityId: app.id } });
      if (body.submit) {
        const admins = await tx.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
        await tx.notification.createMany({ data: admins.map(admin => ({ userId: admin.id, title: "New application", body: `${app.reference} awaits review`, href: `/admin/applications/${app.id}` })) });
      }
      return app;
    });
    return NextResponse.json(application, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
