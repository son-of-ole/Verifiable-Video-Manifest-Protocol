import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VVMP Registry",
  description: "Reference registry surface for Verifiable Video Manifest Protocol"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
