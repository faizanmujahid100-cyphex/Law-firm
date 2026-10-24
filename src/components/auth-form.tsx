"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { browserAuth } from "@/lib/firebase/client";

type Mode = "login" | "signup" | "forgot" | "reset" | "verify";
const titles: Record<Mode, string> = { login: "Welcome back", signup: "Create your client account", forgot: "Reset your password", reset: "Choose a new password", verify: "Verify your email" };

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Authentication failed"); }
    finally { setBusy(false); }
  }
  return <form className="card" style={{ padding: 32, display: "grid", gap: 15, maxWidth: 440, margin: "auto" }} onSubmit={submit}>
    <h1 className="serif" style={{ fontSize: 34, margin: 0 }}>{titles[mode]}</h1>
    {mode === "signup" && <label className="label">Full name<input className="field" name="name" minLength={2} required /></label>}
    {["signup", "login", "forgot"].includes(mode) && <label className="label">Email address<input className="field" name="email" type="email" required /></label>}
    {mode === "signup" && <label className="label">Phone (optional)<input className="field" name="phone" /></label>}
    {["signup", "login", "reset"].includes(mode) && <label className="label">Password {mode !== "login" && "(at least 12 characters)"}<input className="field" name="password" type="password" minLength={mode === "login" ? 1 : 12} required /></label>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? "Please wait…" : { signup: "Create client account", login: "Sign in", forgot: "Send reset link", reset: "Reset password", verify: "Verify email" }[mode]}</button>
    {mode === "login" && <><Link href="/forgot-password">Forgot password?</Link><Link href="/signup">New client? Create an account</Link></>}
    {["verify", "reset"].includes(mode) && <Link href="/login">Back to login</Link>}
  </form>;
}
