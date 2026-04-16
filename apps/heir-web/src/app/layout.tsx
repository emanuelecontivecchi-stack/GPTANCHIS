import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Anchise Heir Portal | Memorial Access",
  description:
    "Heir-side memorial invitation, photo upload, Service 1 checklist, staged Anchise storage preview, and activation flow."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
