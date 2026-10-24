import { NextRequest, NextResponse } from "next/server";
import { firestore } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/auth";
import { verifyOrigin } from "@/lib/security";
import { z } from "zod";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    await verifyOrigin();
    const user = await requireUser(["ADMIN"]);
    const { id } = await params;
    const { status } = z.object({ status: z.enum(["VERIFIED", "REJECTED"]) }).parse(await request.json());
    await firestore().runTransaction(async tx => {
      const paymentRef = firestore().collection("payments").doc(id);
      const payment = await tx.get(paymentRef);
      if (!payment.exists || payment.get("status") !== "PENDING") throw new Error("Payment has already been reviewed");
      const invoiceId = payment.get("invoiceId") as string;
      const invoiceRef = firestore().collection("invoices").doc(invoiceId);
      const invoice = await tx.get(invoiceRef);
      if (!invoice.exists) throw new Error("Invoice not found");
      const payments = await tx.get(firestore().collection("payments").where("invoiceId", "==", invoiceId));
      const verified = payments.docs.filter(doc => doc.get("status") === "VERIFIED").reduce((sum, doc) => sum + Number(doc.get("amountPkr")), 0);
      const balance = Number(invoice.get("amountPkr")) - verified;
      const amount = Number(payment.get("amountPkr"));
      if (status === "VERIFIED" && amount > balance) throw new Error("Amount exceeds outstanding balance");
      const now = new Date();
      const auditRef = firestore().collection("auditLogs").doc();
      const notificationRef = firestore().collection("notifications").doc();
      const app = await tx.get(firestore().collection("applications").doc(invoice.get("applicationId") as string));
      tx.update(paymentRef, { status, verifiedAt: now, verifiedById: user.id });
      if (status === "VERIFIED" && amount === balance) tx.update(invoiceRef, { status: "PAID" });
      tx.create(auditRef, { actorId: user.id, action: status, entity: "Payment", entityId: id, createdAt: now });
      if (app.exists) tx.create(notificationRef, { userId: app.get("clientId"), title: "Payment update", body: `Payment ${status.toLowerCase()}`, href: `/client/applications/${app.id}`, createdAt: now, readAt: null });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 }); }
}
