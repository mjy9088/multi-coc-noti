"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function PwaInstall() {
  const t = useTranslations("Dashboard");
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [environment, setEnvironment] = useState({ ios: false, standalone: true });
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setEnvironment({
      ios: /iPad|iPhone|iPod/.test(navigator.userAgent),
      standalone: window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)),
    }), 0);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeinstallprompt", capture); };
  }, []);

  if (environment.standalone || (!environment.ios && !prompt)) return null;
  const install = async () => {
    if (environment.ios) { setShowIosHelp((value) => !value); return; }
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === "accepted") setPrompt(null);
  };
  return <div className="pwa-install"><button type="button" onClick={install}>{t("installApp")}</button>{showIosHelp && <p role="status">{t("installIosHelp")}</p>}</div>;
}
