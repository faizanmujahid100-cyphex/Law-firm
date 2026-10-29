"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { browserAuth } from "@/lib/firebase/client";
import { demoAccounts } from "@/lib/demo-config";

type Mode = "login" | "signup" | "forgot" | "reset" | "verify";
const titles: Record<Mode, string> = { login: "Welcome back", signup: "Create your client account", forgot: "Reset your password", reset: "Choose a new password", verify: "Verify your email" };

export function AuthForm({ mode, demo = false }: { mode: Mode; demo?: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailValue, setEmail] = useState("");
  const [passwordValue, setPassword] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      if (demo && mode === "login") {
        const response = await fetch("/api/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        router.push(result.role === "ADMIN" ? "/admin" : result.role === "TEAM" ? "/team/dashboard" : "/client");
        router.refresh();
        return;
      }
      if (demo) throw new Error("Email registration and password recovery are unavailable in the demo. Return to login and choose a demo account.");
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(browserAuth(), email, password);
        const name = String(form.get("name") || "");
        await updateProfile(credential.user, { displayName: name });
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: await credential.user.getIdToken(), name, phone: String(form.get("phone") || "") }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        await sendEmailVerification(credential.user);
        await signOut(browserAuth());
        setMessage("Account created. Check your email for the verification link, then sign in.");
      } else if (mode === "login") {
        const credential = await signInWithEmailAndPassword(browserAuth(), email, password);
        if (!credential.user.emailVerified) { await sendEmailVerification(credential.user); throw new Error("Please verify your email. A new link has been sent."); }
        const response = await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: await credential.user.getIdToken(true) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        await signOut(browserAuth());
        router.push(result.role === "ADMIN" ? "/admin" : result.role === "TEAM" ? "/team/dashboard" : "/client");
        router.refresh();
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(browserAuth(), email);
        setMessage("If the address is registered, a reset link has been sent.");
      } else if (mode === "reset") {
        const code = search.get("oobCode");
        if (!code) throw new Error("Reset link is missing its code");
        await confirmPasswordReset(browserAuth(), code, password);
        setMessage("Password reset. You can sign in now.");
      } else {
        const code = search.get("oobCode");
        if (!code) throw new Error("Verification link is missing its code");
        await applyActionCode(browserAuth(), code);
        setMessage("Email verified. You can sign in now.");
      }
    } catch (cause) {
      const code = (cause as { code?: string })?.code;
      const messages: Record<string, string> = {
        "auth/invalid-api-key": "Sign-in is not configured correctly. The site owner must update the Firebase web API key and redeploy.",
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "The Firebase API key is invalid. Ask the site owner to update the configuration.",
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/too-many-requests": "Too many sign-in attempts. Please try again later.",
        "auth/network-request-failed": "Could not connect to sign-in. Check your connection and try again.",
        "auth/operation-not-allowed": "Email and password sign-in must be enabled in Firebase Authentication.",
      };
      setError(code && messages[code] ? messages[code] : cause instanceof Error ? cause.message : "Authentication failed");
    }
    finally { setBusy(false); }
  }
  return <form className="card" style={{ padding: 32, display: "grid", gap: 15, maxWidth: 440, margin: "auto" }} onSubmit={submit}>
    <h1 className="serif" style={{ fontSize: 34, margin: 0 }}>{titles[mode]}</h1>
    {demo && <p className="muted" style={{ margin: 0 }}>Interactive proposal demo. Explore fictional data; changes are temporary. Please use sample information only.</p>}
    {mode === "signup" && <label className="label">Full name<input className="field" name="name" minLength={2} required /></label>}
    {["signup", "login", "forgot"].includes(mode) && <label className="label">Email address<input className="field" name="email" type="email" autoComplete="email" value={emailValue} onChange={e => setEmail(e.target.value)} required /></label>}
    {mode === "signup" && <label className="label">Phone (optional)<input className="field" name="phone" /></label>}
    {["signup", "login", "reset"].includes(mode) && <label className="label">Password {mode !== "login" && "(at least 12 characters)"}<input className="field" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={passwordValue} onChange={e => setPassword(e.target.value)} minLength={mode === "login" ? 1 : 12} required /></label>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? "Please wait…" : { signup: "Create client account", login: "Sign in", forgot: "Send reset link", reset: "Reset password", verify: "Verify email" }[mode]}</button>
    {mode === "login" && !demo && <><Link href="/forgot-password">Forgot password?</Link><Link href="/signup">New client? Create an account</Link></>}
    {mode === "login" && demo && <section aria-label="Demo accounts" style={{ borderTop: "1px solid #e2e8f0", paddingTop: 18, display: "grid", gap: 10 }}>
      <h2 className="serif" style={{ margin: 0, fontSize: 23 }}>Try a demo account</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Click an account to fill the fields, then select Sign in.</p>
      {demoAccounts.map(account => <button type="button" key={account.id} disabled={busy} onClick={() => { setEmail(account.email); setPassword(account.password); setError(""); setMessage(`${account.label} selected. Select Sign in to explore.`); }} className="card demo-account" style={{ padding: 14, textAlign: "left", display: "grid", gap: 4, cursor: "pointer", color: "inherit", width: "100%" }}>
        <strong>{account.label}</strong><span style={{ fontSize: 12, overflowWrap: "anywhere" }}>{account.email}</span><span className="muted" style={{ fontSize: 12 }}>{account.description}</span>
      </button>)}
      <small className="muted">Demo password: <code>{demoAccounts[0].password}</code></small>
    </section>}
    {(["verify", "reset"].includes(mode) || (demo && mode !== "login")) && <Link href="/login">Back to login</Link>}
  </form>;
}
