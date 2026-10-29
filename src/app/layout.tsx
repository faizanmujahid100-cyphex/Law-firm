import type { Metadata } from "next";
import "./globals.css";
import { isDemoMode } from "@/lib/demo-config";
import Link from "next/link";
export const metadata: Metadata = { title: { default: "Amanah Legal | Legal services with clarity", template: "%s | Amanah Legal" }, description: "Professional legal services, domicile and tax assistance, and secure client updates in Pakistan." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{isDemoMode() && <div role="note" style={{ background: "#f5ead5", color: "#34465d", padding: "9px 20px", textAlign: "center", fontSize: 13 }}>Proposal demo · Fictional data · Changes may reset · <Link href="/login" style={{ textDecoration: "underline", fontWeight: 700 }}>Explore demo accounts</Link></div>}{children}</body></html>; }
