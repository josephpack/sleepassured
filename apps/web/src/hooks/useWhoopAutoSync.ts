import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

/**
 * Fire-and-forget hook that silently syncs WHOOP data and
 * auto-populates diary entries when the app opens.
 * Server-side throttle ensures this is a no-op if called within 1 hour.
 */
export function useWhoopAutoSync() {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    api("/whoop/sync?autoPopulate=true", { method: "POST" }).catch(() => {
      // Silently ignore — user may not have WHOOP connected
    });
  }, []);
}
