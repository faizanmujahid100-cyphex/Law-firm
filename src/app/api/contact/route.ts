import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit, verifyOrigin } from "@/lib/security";
import { z } from "zod";
export async function POST(request: NextRequest) {
  try {
    await verifyOrigin();
    await rateLimit(`contact:${await clientIp()}`, 5, 60);
    const input = z.object({ name: z.string().min(2).max(100), email: z.email(), phone: z.string().max(30).optional(), message: z.string().min(20).max(3000), website: z.string().max(0).optional() }).parse(await request.json());
    await db.contactMessage.create({ data: { name: input.name, email: input.email, phone: input.phone, message: input.message } });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
