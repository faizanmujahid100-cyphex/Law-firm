"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { browserAuth } from "@/lib/firebase/client";

type Values = { name: string; phone: string; password: string };
export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const { register, handleSubmit } = useForm<Values>({ defaultValues: { name, phone, password: "" } });
  const [message, setMessage] = useState("");
  return <form className="card" style={{ padding: 24, display: "grid", gap: 14 }} onSubmit={handleSubmit(async values => {
    try {
      let idToken: string | undefined;
      if (values.name !== name) {
        if (!values.password) throw new Error("Enter your current password to change your legal name");
        const credential = await signInWithEmailAndPassword(browserAuth(), email, values.password);
        idToken = await credential.user.getIdToken(true);
      }
      const response = await fetch("/api/auth/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: values.name, phone: values.phone, idToken }) });
      const result = await response.json();
      setMessage(response.ok ? "Profile updated." : result.error);
      if (idToken) await signOut(browserAuth());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed"); }
  })}>
    <label className="label">Full legal name<input className="field" {...register("name", { required: true })} /></label>
    <label className="label">Phone<input className="field" {...register("phone")} /></label>
    <label className="label">Current password (required to change legal name)<input className="field" type="password" autoComplete="current-password" {...register("password")} /></label>
    {message && <p role="status">{message}</p>}
    <button className="btn btn-primary">Save profile</button>
  </form>;
}
