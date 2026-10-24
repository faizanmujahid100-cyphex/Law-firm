export async function sendEmail(to: string, subject: string, text: string) {
  const endpoint = process.env.EMAIL_API_URL;
  const token = process.env.EMAIL_API_TOKEN;
  if (!endpoint || !token) return { sent: false as const, reason: "Email provider is not configured" };
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ to, subject, text }) });
  if (!response.ok) throw new Error("Email provider rejected the message");
  return { sent: true as const };
}
