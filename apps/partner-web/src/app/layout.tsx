import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Anchise Partner Portal | Henri de Borniol",
  description:
    "Partner-side memorial dossier intake, checklist gating, payment state, biometric review, and heir release workflow for Henri de Borniol."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
