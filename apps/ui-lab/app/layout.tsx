import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LabShell } from "./lab-shell";

export const metadata: Metadata = {
  title: "Multi CoC UI Lab",
  description: "Design tokens, components, and route layout catalogue",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LabShell>{children}</LabShell>
      </body>
    </html>
  );
}
