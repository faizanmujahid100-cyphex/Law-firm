const required = ["APP_URL", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "DATA_ENCRYPTION_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
if (Buffer.from(process.env.DATA_ENCRYPTION_KEY, "base64").length !== 32) throw new Error("DATA_ENCRYPTION_KEY must decode to 32 bytes");
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required");
const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (account.project_id !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !account.client_email || !account.private_key?.includes("BEGIN PRIVATE KEY")) throw new Error("Firebase service account does not match the configured project");
if (process.env.VERCEL && !process.env.APP_URL.startsWith("https://")) throw new Error("APP_URL must use HTTPS on Vercel");
console.log("Firebase environment configuration is present and consistent");
