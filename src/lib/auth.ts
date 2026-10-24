import "server-only";
import { cookies } from "next/headers";
import { firebaseAuth, firestore } from "@/lib/firebase/admin";

export type Role = "ADMIN" | "TEAM" | "CLIENT";
export type AppUser = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: Role;
  active: boolean;
  teamProfile?: { title: string; permissions: string[]; publicApproved?: boolean; bio?: string; qualifications?: string; practiceAreas?: string[] } | null;
};

const cookieName = "amanah_session";
const sessionLength = 5 * 24 * 60 * 60 * 1000;

export async function createSession(idToken: string) {
  const decoded = await firebaseAuth().verifyIdToken(idToken, true);
  if (!decoded.email_verified || Date.now() / 1000 - decoded.auth_time > 300) throw new Error("Recent verified sign in required");
  const user = await getUser(decoded.uid);
  if (!user?.active || user.role !== decoded.role) throw new Error("Account is unavailable");
  const session = await firebaseAuth().createSessionCookie(idToken, { expiresIn: sessionLength });
  (await cookies()).set(cookieName, session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: sessionLength / 1000 });
  return user;
}

export async function getUser(id: string): Promise<AppUser | null> {
  const snap = await firestore().collection("users").doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } as AppUser : null;
}

export async function currentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const decoded = await firebaseAuth().verifySessionCookie(token, true);
    const user = await getUser(decoded.uid);
    return user?.active && user.role === decoded.role ? user : null;
  } catch { return null; }
}

export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  if (!user || (roles && !roles.includes(user.role))) throw new Error("Access denied");
  return user;
}

export async function endSession() { (await cookies()).delete(cookieName); }

export function hasPermission(user: AppUser, permission: string) {
  return user.role === "ADMIN" || (user.role === "TEAM" && !!user.teamProfile?.permissions.includes(permission));
}
