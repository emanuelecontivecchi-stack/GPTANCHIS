import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Anchise | Partner and Heir Prototypes",
  description:
    "Henri de Borniol partner and heir wireframes for memorial dossiers, staged uploads, Service 2 controls, Service 1 extras, and Anchise activation."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
