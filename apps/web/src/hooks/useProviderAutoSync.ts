import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { isNativeIOS, fetchHealthKitSleep } from "@/features/providers/apple-health/healthkit";
import { syncAppleHealth, getProviderStatus } from "@/features/providers/api";

interface SyncResponse {
  needsReauth?: boolean;
}

/**
 * Unified auto-sync hook. On app open:
 * 1. Triggers WHOOP sync (if connected) — server-pull model
 * 2. Triggers Apple Health sync (if native iOS + connected) — client-push model
 *
 * Returns whether any provider needs re-auth and which providers are connected.
 */
export function useProviderAutoSync() {
  const hasFired = useRef(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    async function sync() {
      // 1. WHOOP auto-sync (existing behaviour — server-pull)
      try {
        const data = await api<SyncResponse>("/whoop/sync?autoPopulate=true", { method: "POST" });
        if (data?.needsReauth) {
          setNeedsReauth(true);
        }
      } catch {
        // Silently ignore — user may not have WHOOP connected
      }

      // 2. Apple Health auto-sync (client-push, native iOS only)
      if (isNativeIOS()) {
        try {
          const status = await getProviderStatus();
          const appleHealth = status.providers.find((p) => p.slug === "apple_health");
          if (appleHealth?.connected) {
            const records = await fetchHealthKitSleep(2);
            if (records.length > 0) {
              await syncAppleHealth(records);
            }
          }
        } catch {
          // Silently ignore — non-blocking
        }
      }

      // 3. Fetch connected provider list for UI
      try {
        const status = await getProviderStatus();
        const connected = status.providers
          .filter((p) => p.connected)
          .map((p) => p.slug);
        setConnectedProviders(connected);
      } catch {
        // ignore
      }
    }

    sync();
  }, []);

  return { needsReauth, connectedProviders };
}
