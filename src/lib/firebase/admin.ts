import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { initializeFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { isDemoMode } from "@/lib/demo-config";
import { demoFirestore } from "@/lib/demo-store";
import { randomUUID } from "node:crypto";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function serviceAccount(): ServiceAccount {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) return JSON.parse(json) as ServiceAccount;
  throw new Error("Firebase Admin credentials are not configured");
}

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const account = serviceAccount();
  return initializeApp({ credential: cert({ projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key }), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
}

export const firebaseAuth = () => {
  if (isDemoMode()) return {
    // These operations affect only fictional records in the visitor's demo store.
    createUser: async () => ({ uid: `demo-${randomUUID()}` }),
    updateUser: async (uid: string) => ({ uid }),
    deleteUser: async (uid: string) => { await demoFirestore.collection("users").doc(uid).delete(); },
    setCustomUserClaims: async () => undefined,
    revokeRefreshTokens: async () => undefined,
    generatePasswordResetLink: async () => { throw new Error("Demo accounts do not send email"); },
    verifyIdToken: async () => { throw new Error("Use a demo account from the login page"); },
    verifySessionCookie: async () => { throw new Error("Firebase sessions are disabled in demo mode"); },
  } as unknown as ReturnType<typeof getAuth>;
  return getAuth(app());
};
export const firestore = () => isDemoMode() ? demoFirestore as unknown as FirebaseFirestore.Firestore : initializeFirestore(app(), { preferRest: true });
export const storageBucket = () => getStorage(app()).bucket();
