import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
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
  getWhoopStatus,
  getWhoopAuthUrl,
  disconnectWhoop,
  syncWhoopData,
  WhoopStatus,
} from "@/features/whoop/api/whoop";
import { Loader2, Link2, Link2Off, RefreshCw, CheckCircle2 } from "lucide-react";

export function WhoopConnect() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<WhoopStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getWhoopStatus();
      setStatus(data);
    } catch (error) {
      console.error("Failed to fetch WHOOP status:", error);
      toast.error("Failed to check WHOOP connection status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle OAuth callback results
  useEffect(() => {
    const whoopConnected = searchParams.get("whoop_connected");
    const whoopError = searchParams.get("whoop_error");

    if (whoopConnected === "true") {
      toast.success("WHOOP account connected successfully!");
      fetchStatus();
      // Clean up URL
      searchParams.delete("whoop_connected");
      setSearchParams(searchParams, { replace: true });
    } else if (whoopError) {
      const errorMessages: Record<string, string> = {
        invalid_request: "Invalid request. Please try again.",
        invalid_state: "Session expired. Please try connecting again.",
        account_already_linked:
          "This WHOOP account is already linked to another user.",
        connection_failed: "Failed to connect WHOOP account. Please try again.",
        access_denied: "Access was denied. Please authorize the connection.",
      };
      toast.error(errorMessages[whoopError] || "Failed to connect WHOOP account");
      // Clean up URL
      searchParams.delete("whoop_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, fetchStatus]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { authUrl } = await getWhoopAuthUrl(location.pathname);
      // Redirect to WHOOP OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      toast.error("Failed to initiate WHOOP connection");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectWhoop();
      setStatus({ connected: false });
      toast.success("WHOOP account disconnected");
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error("Failed to disconnect WHOOP account");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncWhoopData();
      toast.success(`Synced ${result.recordsSynced} sleep records`);
      fetchStatus();
    } catch (error) {
      console.error("Failed to sync:", error);
      toast.error("Failed to sync WHOOP data");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
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
          <CardTitle>WHOOP Integration</CardTitle>
          <CardDescription>
            Connect your WHOOP account to sync sleep data automatically
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
          WHOOP Integration
          {status?.connected && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
        </CardTitle>
        <CardDescription>
          {status?.connected
            ? "Your WHOOP account is connected"
            : "Connect your WHOOP account to sync sleep data automatically"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status?.connected ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Connected:</span>{" "}
                {formatDate(status.connectedAt)}
              </p>
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
              Connecting your WHOOP account allows us to automatically import
              your sleep data, including sleep stages, efficiency, and recovery
              scores.
            </p>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {isConnecting ? "Connecting..." : "Connect WHOOP"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
