import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { demoAccounts, isDemoMode } from "@/lib/demo-config";
import { demoCookie } from "@/lib/demo-store";
import { verifyOrigin } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!isDemoMode()) return NextResponse.json({ error: "Demo access is disabled" }, { status: 404 });
  try {
    await verifyOrigin();
    const { email, password } = await request.json();
    const account = demoAccounts.find(a => a.email === String(email).trim().toLowerCase() && a.password === password);
    if (!account) return NextResponse.json({ error: "Choose one of the demo accounts below and use its displayed password." }, { status: 401 });
    (await cookies()).set(demoCookie, `${randomUUID()}.${account.role}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
    return NextResponse.json({ role: account.role });
  } catch { return NextResponse.json({ error: "Unable to start the demo session" }, { status: 400 }); }
}
