import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireUser(["ADMIN", "TEAM"]);
    const where = user.role === "ADMIN" ? {} : { OR: [{ assigneeId: user.id }, ...(hasPermission(user, "tasks.claim") ? [{ status: "QUEUED" as const, assigneeId: null, eligibleRoles: { has: user.teamProfile?.title ?? "" } }] : [])] };
    return NextResponse.json(await db.task.findMany({ where, include: { application: { select: { reference: true, service: { select: { title: true } } } }, assignee: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }));
  } catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
}

export async function POST(request: NextRequest) {
  try {
    await verifyOrigin();
    const user = await requireUser(["ADMIN"]);
    const body = z.object({ title: z.string().min(3).max(160), instructions: z.string().min(5), applicationId: z.string().nullable().optional(), assigneeId: z.string().nullable().optional(), eligibleRoles: z.array(z.string()).default([]), priority: z.number().int().min(1).max(3).default(2), dueAt: z.iso.datetime().nullable().optional() }).parse(await request.json());
    if (body.assigneeId) {
      const member = await db.user.findUnique({ where: { id: body.assigneeId } });
      if (!member || member.role !== "TEAM" || !member.active) throw new Error("Invalid assignee");
    }
    if (body.applicationId && !await db.application.findUnique({ where: { id: body.applicationId } })) throw new Error("Application not found");
    const task = await db.$transaction(async tx => {
      const created = await tx.task.create({ data: { title: body.title, instructions: body.instructions, applicationId: body.applicationId, assigneeId: body.assigneeId, status: body.assigneeId ? "ASSIGNED" : "QUEUED", eligibleRoles: body.eligibleRoles, priority: body.priority, dueAt: body.dueAt ? new Date(body.dueAt) : null } });
      await tx.taskAssignmentHistory.create({ data: { taskId: created.id, actorId: user.id, action: body.assigneeId ? "ASSIGN" : "QUEUE", toAssigneeId: body.assigneeId } });
      await tx.auditLog.create({ data: { actorId: user.id, action: body.assigneeId ? "ASSIGN" : "QUEUE", entity: "Task", entityId: created.id } });
      if (body.assigneeId) await tx.notification.create({ data: { userId: body.assigneeId, title: "New task assigned", body: created.title, href: `/team/tasks/${created.id}` } });
      return created;
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
