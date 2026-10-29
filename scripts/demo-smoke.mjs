import assert from "node:assert/strict";

// Run against a local demo server: node scripts/demo-smoke.mjs http://localhost:3000
const origin = process.argv[2] || "http://localhost:3000";
let checks = 0;
async function request(path, { cookie, method = "GET", body, status = 200 } = {}) {
  const response = await fetch(new URL(path, origin), { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json", origin } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${response.status} ${text.slice(0, 400)}`);
  assert.ok(!text.includes('"digest":"'), `Server render failed: ${path}`);
  checks++;
  return { response, text, data: () => JSON.parse(text) };
}
async function login(role) {
  const result = await request("/api/auth/demo", { method: "POST", body: { email: `${role}@demo.amanah.test`, password: "AmanahDemo2026!" } });
  const cookie = result.response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("amanah_demo="));
  return cookie;
}
const loginPage = await request("/login");
assert.match(loginPage.text, /Try a demo account/);
for (const path of ["/", "/about", "/services", "/services/punjab-domicile-assistance", "/team", "/contact", "/privacy", "/terms", "/disclaimer"]) await request(path);
await request("/api/applications", { status: 403 });
await request("/api/auth/demo", { method: "POST", body: { email: "admin@demo.amanah.test", password: "wrong" }, status: 401 });
const sessions = {};
for (const role of ["admin", "team", "client"]) {
  const cookie = sessions[role] = await login(role);
  const root = role === "admin" ? "/admin" : role === "team" ? "/team/dashboard" : "/client";
  const queue = [root];
  const visited = new Set();
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    const result = await request(path, { cookie });
    for (const match of result.text.matchAll(/href="([^"?#]+)"/g)) {
      const href = match[1].replaceAll("&amp;", "&");
      if ((href === root || href.startsWith(root + "/")) && !visited.has(href)) queue.push(href);
    }
  }
  console.log(`${role}: checked ${visited.size} workspace pages`);
}
const { admin, team, client } = sessions;
await request("/admin", { cookie: client, status: 307 });
await request("/api/team", { cookie: client, status: 403 });
await request("/api/tasks/demo-task-3", { cookie: team, method: "PATCH", body: { action: "claim" } });
await request("/api/tasks/demo-task-3", { cookie: team, method: "PATCH", body: { action: "claim" }, status: 409 });
await request("/api/tasks/demo-task-3", { cookie: team, method: "PATCH", body: { action: "accept" } });
await request("/api/payments/demo-payment-2", { cookie: admin, method: "PATCH", body: { status: "VERIFIED" } });
await request("/api/payments/demo-payment-2", { cookie: admin, method: "PATCH", body: { status: "VERIFIED" }, status: 400 });
await request("/api/payments/demo-payment-2", { cookie: client, method: "PATCH", body: { status: "VERIFIED" }, status: 400 });
await request("/api/notifications/demo-client-notice-1", { cookie: client, method: "PATCH", body: {} });
await request("/api/auth/profile", { cookie: client, method: "POST", body: { name: "Demo Visitor", phone: "+92 300 0000000" } });
const app = await request("/api/applications", { cookie: client, method: "POST", body: { serviceId: "demo-business", data: { full_name: "Demo Visitor", district: "Lahore" }, submit: true }, status: 201 });
await request(`/client/applications/${app.data().id}`, { cookie: client });
const file = await request("/api/documents/demo-document-1", { cookie: client });
await request(file.data().url, { cookie: client });
await request(file.data().url, { status: 403 });
const otherClient = await login("client");
const otherApps = await request("/api/applications", { cookie: otherClient });
assert.ok(!otherApps.data().some(a => a.id === app.data().id), "Demo sessions must not share mutations");
await request("/api/team", { cookie: admin, method: "POST", body: { name: "Demo Advocate", email: "new@example.test", title: "Advocate", permissions: ["tasks.claim"] }, status: 201 });
await request("/api/clients/demo-client", { cookie: admin, method: "PATCH", body: { name: "Sample Client", phone: "+92 300 0000000" } });
await request("/api/team/demo-team", { cookie: admin, method: "PATCH", body: { bio: "Updated sample biography" } });
await request("/api/cases/demo-case-1", { cookie: team, method: "PATCH", body: { hearing: { date: new Date(Date.now() + 86400000).toISOString(), notes: "Sample hearing added during smoke test" } } });
await request("/api/invoices", { cookie: admin, method: "POST", body: { applicationId: "demo-application-4", amountPkr: 5000 }, status: 201 });
await request("/api/content", { cookie: admin, method: "POST", body: { type: "faq", question: "A sample question?", answer: "A sample answer for the demo.", published: true }, status: 201 });
const uploadForm = new FormData();
uploadForm.set("applicationId", "demo-application-5");
uploadForm.set("category", "Supporting document");
uploadForm.set("file", new Blob(["%PDF-1.4\nSample proposal document\n%%EOF"], { type: "application/pdf" }), "sample.pdf");
const upload = await fetch(new URL("/api/documents", origin), { method: "POST", headers: { cookie: client, origin }, body: uploadForm });
assert.equal(upload.status, 201, await upload.clone().text());
checks++;
const uploaded = await upload.json();
const uploadedLink = await request(`/api/documents/${uploaded.id}`, { cookie: client });
const downloaded = await request(uploadedLink.data().url, { cookie: client });
assert.match(downloaded.text, /%PDF-1.4/);
await request("/api/auth/logout", { cookie: client, method: "POST", body: {} });
console.log(`Demo smoke checks passed (${checks} requests).`);
