import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Module-level state shared across all hook instances
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    subscribers.forEach((fn) => fn());
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as unknown as { standalone: boolean }).standalone)
  );
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function usePwaInstall() {
  const [prompt, setPrompt] = useState(deferredPrompt);
  const [installed] = useState(() => isStandalone());
  const ios = isIOS();
  const canInstall = !installed && (!!prompt || ios);

  useEffect(() => {
    const sync = () => setPrompt(deferredPrompt);
    subscribers.add(sync);
    return () => { subscribers.delete(sync); };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      setPrompt(null);
      return true;
    }
    return false;
  }, [prompt]);

  return { canInstall, isIos: ios, isInstalled: installed, hasNativePrompt: !!prompt, install };
}
