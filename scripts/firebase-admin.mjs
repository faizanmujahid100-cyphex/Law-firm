import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { initializeFirestore } from "firebase-admin/firestore";

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required");
const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key }) });
export const auth = getAuth(app);
export const db = initializeFirestore(app, { preferRest: true });
