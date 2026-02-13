import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;

function wasDismissedRecently(): boolean {
  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (!dismissed) return false;
  const dismissedAt = Number(dismissed);
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
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

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) {
      setDismissed(true);
      return;
    }

    // Android / Chrome — capture the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari — show manual guide
    if (isIOS()) {
      setShowIOSGuide(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDismissed(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  // Don't render if already installed, dismissed, or no prompt available
  if (dismissed || isStandalone()) return null;
  if (!deferredPrompt && !showIOSGuide) return null;

  return (
    <div className="mx-4 mb-4">
      <div className="relative rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Android / Chrome — one-tap install */}
        {deferredPrompt && (
          <div className="flex items-center gap-3 pr-6">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Install SleepAssured</p>
              <p className="text-xs text-muted-foreground">
                Add to your home screen for the best experience
              </p>
            </div>
            <Button size="sm" onClick={handleInstall} className="shrink-0">
              Install
            </Button>
          </div>
        )}

        {/* iOS Safari — step-by-step guide */}
        {showIOSGuide && !deferredPrompt && (
          <div className="pr-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Install SleepAssured</p>
                <p className="text-xs text-muted-foreground">
                  Add to your home screen in 2 taps
                </p>
              </div>
            </div>
            <div className="space-y-2 ml-1">
              <div className="flex items-center gap-2.5 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  1
                </span>
                <span>
                  Tap the <Share className="inline h-4 w-4 align-text-bottom mx-0.5" /> Share button
                  at the bottom of Safari
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  2
                </span>
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
