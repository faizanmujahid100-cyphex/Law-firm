import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { serviceSchema } from "@/lib/validation";

export async function GET() {
  const services = await db.service.findMany({ where: { published: true }, include: { versions: { orderBy: { version: "desc" }, take: 1 }, category: true }, orderBy: { title: "asc" } });
  return NextResponse.json(services);
}

export async function POST(request: NextRequest) {
  try {
    await verifyOrigin();
    const user = await requireUser(["ADMIN"]);
    const input = serviceSchema.parse(await request.json());
    const service = await db.$transaction(async tx => {
      const s = await tx.service.create({ data: { slug: input.slug, title: input.title, summary: input.summary, description: input.description, published: input.published, featured: input.featured, feePkr: input.feePkr, estimate: input.estimate, jurisdiction: input.jurisdiction, sourceUrl: input.sourceUrl, reviewedAt: new Date() } });
      await tx.serviceVersion.create({ data: { serviceId: s.id, version: 1, form: input.config.fields, requirements: input.config.documents, workflow: input.config.workflow } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "CREATE", entity: "Service", entityId: s.id } });
      return s;
    });
    return NextResponse.json(service, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
