import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VVMP Trust Viewer",
    template: "%s | VVMP Trust Viewer"
  },
  description: "Fixture-backed Next.js viewer for Verifiable Video Manifest Protocol"
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
