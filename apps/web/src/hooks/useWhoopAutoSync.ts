import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface SyncResponse {
  needsReauth?: boolean;
}

/**
 * Hook that silently syncs WHOOP data and auto-populates diary entries
 * when the app opens. Returns whether the connection needs re-authorisation.
 * Server-side throttle ensures this is a no-op if called within 1 hour.
 */
export function useWhoopAutoSync() {
  const hasFired = useRef(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    api<SyncResponse>("/whoop/sync?autoPopulate=true", { method: "POST" })
      .then((data) => {
        if (data?.needsReauth) {
          setNeedsReauth(true);
        }
      })
      .catch(() => {
        // Silently ignore — user may not have WHOOP connected
      });
  }, []);

  return { needsReauth };
}
