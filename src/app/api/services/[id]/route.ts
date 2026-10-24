import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { serviceSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    await verifyOrigin();
    const user = await requireUser(["ADMIN"]);
    const { id } = await params;
    const input = serviceSchema.parse(await request.json());
    const updated = await db.$transaction(async tx => {
      const old = await tx.service.findUniqueOrThrow({ where: { id }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
      const s = await tx.service.update({ where: { id }, data: { slug: input.slug, title: input.title, summary: input.summary, description: input.description, published: input.published, featured: input.featured, feePkr: input.feePkr, estimate: input.estimate, jurisdiction: input.jurisdiction, sourceUrl: input.sourceUrl, reviewedAt: new Date() } });
      await tx.serviceVersion.create({ data: { serviceId: id, version: (old.versions[0]?.version ?? 0) + 1, form: input.config.fields, requirements: input.config.documents, workflow: input.config.workflow } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "UPDATE", entity: "Service", entityId: id } });
      return s;
    });
    return NextResponse.json(updated);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
