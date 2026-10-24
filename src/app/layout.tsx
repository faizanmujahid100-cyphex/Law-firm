import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Amanah Legal | Legal services with clarity", template: "%s | Amanah Legal" }, description: "Professional legal services, domicile and tax assistance, and secure client updates in Pakistan." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
