import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { z } from "zod";
import { firestore } from "@/lib/firebase/admin";
type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(["ADMIN", "TEAM"]);
    const { id } = await params;
    const task = await db.task.findUnique({ where: { id }, include: { application: { include: { client: { select: { name: true, phone: true } }, service: { select: { title: true } }, documents: true } }, history: { orderBy: { createdAt: "asc" } }, comments: { orderBy: { createdAt: "asc" } }, documents: true } });
    if (!task || (user.role === "TEAM" && task.assigneeId !== user.id && !(hasPermission(user, "tasks.claim") && task.status === "QUEUED" && task.eligibleRoles.includes(user.teamProfile?.title ?? "")))) throw new Error("Access denied");
    if (user.role === "TEAM" && task.status === "QUEUED") return NextResponse.json({ id: task.id, title: task.title, instructions: task.instructions, priority: task.priority, dueAt: task.dueAt, estimatedHours: task.estimatedHours, status: task.status, application: task.application ? { reference: task.application.reference, service: task.application.service } : null });
    return NextResponse.json(task);
  } catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    await verifyOrigin();
    const user = await requireUser(["ADMIN", "TEAM"]);
    const { id } = await params;
    const body = z.object({ action: z.enum(["claim", "accept", "progress", "review", "complete", "release", "reassign", "cancel", "comment"]), reason: z.string().max(1000).optional(), assigneeId: z.string().nullable().optional(), comment: z.string().max(2000).optional() }).parse(await request.json());
    const task = await db.task.findUniqueOrThrow({ where: { id } });
    if (body.action === "claim") {
      if (user.role !== "TEAM" || !hasPermission(user, "tasks.claim") || !task.eligibleRoles.includes(user.teamProfile?.title ?? "")) throw new Error("Not eligible to claim this task");
      const result = await firestore().runTransaction(async tx => {
        const taskRef = firestore().collection("tasks").doc(id);
        const snapshot = await tx.get(taskRef);
        if (!snapshot.exists || snapshot.get("status") !== "QUEUED" || snapshot.get("assigneeId")) return false;
        const historyRef = firestore().collection("taskAssignmentHistory").doc();
        const auditRef = firestore().collection("auditLogs").doc();
        const now = new Date();
        tx.update(taskRef, { assigneeId: user.id, status: "ASSIGNED", updatedAt: now });
        tx.create(historyRef, { taskId: id, actorId: user.id, toAssigneeId: user.id, action: "CLAIM", createdAt: now });
        tx.create(auditRef, { actorId: user.id, action: "CLAIM", entity: "Task", entityId: id, createdAt: now });
        return true;
      });
      return result ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "This task is no longer available" }, { status: 409 });
    }
    if (body.action === "comment") {
      if (user.role !== "ADMIN" && task.assigneeId !== user.id) throw new Error("Access denied");
      if (!body.comment?.trim()) throw new Error("Comment required");
      await db.taskComment.create({ data: { taskId: id, authorId: user.id, body: body.comment } });
      return NextResponse.json({ ok: true });
    }
    const adminOnly = ["release", "reassign", "cancel", "complete"];
    if (adminOnly.includes(body.action) && user.role !== "ADMIN") throw new Error("Access denied");
    if (user.role === "TEAM" && task.assigneeId !== user.id) throw new Error("Access denied");
    const teamTransitions: Record<string, string[]> = { accept: ["ASSIGNED"], progress: ["ACCEPTED", "IN_PROGRESS"], review: ["IN_PROGRESS"] };
    if (user.role === "TEAM" && !(teamTransitions[body.action] || []).includes(task.status)) throw new Error("Invalid task transition");
    if (body.action === "release" && task.status === "CANCELLED") throw new Error("Cancelled tasks cannot be released");
    if (body.action === "release" && !body.reason?.trim()) throw new Error("A release reason is required");
    if (body.action === "reassign" && body.assigneeId) {
      const member = await db.user.findUnique({ where: { id: body.assigneeId } });
      if (!member || member.role !== "TEAM" || !member.active) throw new Error("Invalid assignee");
    }
    const status = { accept: "ACCEPTED", progress: "IN_PROGRESS", review: "REVIEW", complete: "COMPLETED", release: "QUEUED", reassign: body.assigneeId ? "ASSIGNED" : "QUEUED", cancel: "CANCELLED" }[body.action] as "ACCEPTED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "QUEUED" | "ASSIGNED" | "CANCELLED";
    await db.$transaction(async tx => {
      await tx.task.update({ where: { id }, data: { status, assigneeId: body.action === "release" ? null : body.action === "reassign" ? body.assigneeId : undefined } });
      await tx.taskAssignmentHistory.create({ data: { taskId: id, actorId: user.id, fromAssigneeId: task.assigneeId, toAssigneeId: body.action === "release" ? null : body.action === "reassign" ? body.assigneeId : task.assigneeId, action: body.action.toUpperCase(), reason: body.reason } });
      await tx.auditLog.create({ data: { actorId: user.id, action: body.action.toUpperCase(), entity: "Task", entityId: id } });
      if (body.action === "reassign" && body.assigneeId) await tx.notification.create({ data: { userId: body.assigneeId, title: "Task assigned", body: task.title, href: `/team/tasks/${id}` } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
