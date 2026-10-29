export const demoAccounts = [
  { id: "demo-admin", role: "ADMIN", label: "Administrator", name: "Ayesha Malik", email: "admin@demo.amanah.test", password: "AmanahDemo2026!", description: "Manage clients, applications, team and billing" },
  { id: "demo-team", role: "TEAM", label: "Team member", name: "Hassan Ali", email: "team@demo.amanah.test", password: "AmanahDemo2026!", description: "Explore assigned tasks, the shared queue and cases" },
  { id: "demo-client", role: "CLIENT", label: "Client", name: "Sara Ahmed", email: "client@demo.amanah.test", password: "AmanahDemo2026!", description: "Track applications, documents, invoices and updates" },
] as const;

// Server-only decision: never use a public environment flag to grant real access.
export function isDemoMode() {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  return !process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}
