import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { initializeFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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

export const firebaseAuth = () => getAuth(app());
export const firestore = () => initializeFirestore(app(), { preferRest: true });
export const storageBucket = () => getStorage(app()).bucket();
