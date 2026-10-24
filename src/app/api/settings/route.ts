import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { z } from "zod";
export async function PUT(request: NextRequest) {
  try {
    await verifyOrigin();
    const user = await requireUser(["ADMIN"]);
    const input = z.object({ name: z.string().min(2), tagline: z.string(), about: z.string(), mission: z.string(), address: z.string(), phone: z.string(), email: z.email(), hours: z.string(), privacy: z.string(), terms: z.string(), disclaimer: z.string() }).parse(await request.json());
    const settings = await db.firmSettings.upsert({ where: { id: "default" }, update: input, create: { id: "default", ...input } });
    await db.auditLog.create({ data: { actorId: user.id, action: "UPDATE", entity: "FirmSettings", entityId: "default" } });
    return NextResponse.json(settings);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
