import type { ReactNode } from "react";
import SettingsShell from "./settings-shell";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SettingsShell />
      {children}
    </>
  );
}
