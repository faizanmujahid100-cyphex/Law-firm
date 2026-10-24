import { randomBytes } from "node:crypto";
import { auth, db } from "./firebase-admin.mjs";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Firm Administrator";
const password = process.env.ADMIN_PASSWORD || randomBytes(24).toString("base64url");
if (!email || password.length < 16) throw new Error("Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (at least 16 characters)");
const existing = await db.collection("users").where("role", "==", "ADMIN").limit(1).get();
if (!existing.empty) throw new Error("An administrator already exists. This script creates only the first administrator.");
const user = await auth.createUser({ email, password, displayName: name, emailVerified: true });
try {
  await auth.setCustomUserClaims(user.uid, { role: "ADMIN" });
  await db.collection("users").doc(user.uid).create({ email, name, role: "ADMIN", active: true, phone: null, createdAt: new Date(), updatedAt: new Date() });
  await db.collection("auditLogs").add({ actorId: user.uid, action: "FIRST_ADMIN_SETUP", entity: "User", entityId: user.uid, createdAt: new Date() });
  console.log(`First administrator created: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Temporary password: ${password}`);
} catch (error) { await auth.deleteUser(user.uid); throw error; }
