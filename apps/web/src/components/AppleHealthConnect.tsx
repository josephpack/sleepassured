import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  getProviderStatus,
  connectAppleHealth,
  disconnectAppleHealth,
  syncAppleHealth,
} from "@/features/providers/api";
import {
  isNativeIOS,
  requestHealthKitPermission,
  isHealthKitAvailable,
  fetchHealthKitSleep,
} from "@/features/providers/apple-health/healthkit";
import { Loader2, Link2, Link2Off, RefreshCw, CheckCircle2, Heart } from "lucide-react";

interface AppleHealthStatus {
  connected: boolean;
  lastSyncedAt: string | null;
}

export function AppleHealthConnect() {
  const [status, setStatus] = useState<AppleHealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [available, setAvailable] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getProviderStatus();
      const ah = data.providers.find((p) => p.slug === "apple_health");
      setStatus({
        connected: ah?.connected ?? false,
        lastSyncedAt: ah?.lastSyncedAt ?? null,
      });
    } catch (error) {
      console.error("Failed to fetch Apple Health status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only show this component on native iOS
    if (!isNativeIOS()) {
      setIsLoading(false);
      return;
    }

    isHealthKitAvailable().then((avail) => {
      setAvailable(avail);
      if (avail) fetchStatus();
      else setIsLoading(false);
    });
  }, [fetchStatus]);

  // Don't render on web or if HealthKit unavailable
  if (!isNativeIOS() || (!isLoading && !available)) {
    return null;
  }

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const granted = await requestHealthKitPermission();
      if (!granted) {
        toast.error("Could not request HealthKit permissions");
        return;
      }

      // Mark as connected on the server
      await connectAppleHealth();

      // Do an initial sync
      const records = await fetchHealthKitSleep(7);
      if (records.length > 0) {
        const result = await syncAppleHealth(records);
        toast.success(`Apple Health connected. ${result.created} sleep records synced.`);
      } else {
        toast.success("Apple Health connected. No recent sleep data found yet.");
      }

      fetchStatus();
    } catch (error) {
      console.error("Failed to connect Apple Health:", error);
      toast.error("Failed to connect Apple Health");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectAppleHealth();
      setStatus({ connected: false, lastSyncedAt: null });
      toast.success("Apple Health disconnected");
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error("Failed to disconnect Apple Health");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const records = await fetchHealthKitSleep(7);
      if (records.length > 0) {
        const result = await syncAppleHealth(records);
        toast.success(`Synced ${result.created} new sleep records`);
      } else {
        toast.success("No new sleep data to sync");
      }
      fetchStatus();
    } catch (error) {
      console.error("Failed to sync:", error);
      toast.error("Failed to sync Apple Health data");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Apple Health</CardTitle>
          <CardDescription>
            Connect Apple Health to sync sleep data automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Apple Health
          {status?.connected && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
        </CardTitle>
        <CardDescription>
          {status?.connected
            ? "Apple Health is connected"
            : "Connect Apple Health to sync sleep data from your iPhone"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status?.connected ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Last synced:</span>{" "}
                {formatDate(status.lastSyncedAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2Off className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connecting Apple Health allows us to automatically import your
              sleep data, including sleep stages, duration, and efficiency.
            </p>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {isConnecting ? "Connecting..." : "Connect Apple Health"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
