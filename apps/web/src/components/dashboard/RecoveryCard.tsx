import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  getLatestRecovery,
  getWhoopAuthUrl,
  WhoopRecoveryResponse,
} from "@/features/whoop/api/whoop";

function getRecoveryColor(score: number): string {
  if (score >= 67) return "text-green-500";
  if (score >= 34) return "text-yellow-500";
  return "text-red-500";
}

function getRecoveryBgColor(score: number): string {
  if (score >= 67) return "bg-green-500/10";
  if (score >= 34) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

function getRecoveryLabel(score: number): string {
  if (score >= 67) return "Green";
  if (score >= 34) return "Yellow";
  return "Red";
}

export function RecoveryCard() {
  const location = useLocation();
  const [data, setData] = useState<WhoopRecoveryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await getLatestRecovery();
        setData(response);
      } catch (error) {
        console.error("Failed to load recovery data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { authUrl } = await getWhoopAuthUrl(location.pathname);
      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      toast.error("Failed to initiate WHOOP connection");
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Not connected — show connect prompt
  if (!data?.connected) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Connect Your WHOOP</h3>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                Sync your sleep data automatically and see your recovery score,
                HRV, and resting heart rate right here.
              </p>
              <Button onClick={handleConnect} disabled={isConnecting} size="sm">
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                {isConnecting ? "Connecting..." : "Connect WHOOP"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show message if connected but no recovery data yet
  if (!data.recovery) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            WHOOP Recovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recovery data yet. Sync your WHOOP to see your recovery score.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { score } = data.recovery;
  const colorClass = getRecoveryColor(score);
  const bgColorClass = getRecoveryBgColor(score);
  const label = getRecoveryLabel(score);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          WHOOP Recovery
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full ${bgColorClass}`}
          >
            <span className={`text-2xl font-bold ${colorClass}`}>{score}%</span>
          </div>
          <div>
            <p className={`text-lg font-semibold ${colorClass}`}>{label}</p>
            <p className="text-sm text-muted-foreground">
              {score >= 67
                ? "Ready for peak performance"
                : score >= 34
                  ? "Moderate capacity today"
                  : "Consider rest and recovery"}
            </p>
          </div>
        </div>
        {(data.recovery.hrvRmssd || data.recovery.restingHeartRate) && (
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
            {data.recovery.hrvRmssd && (
              <span>HRV: {data.recovery.hrvRmssd.toFixed(0)} ms</span>
            )}
            {data.recovery.restingHeartRate && (
              <span>RHR: {data.recovery.restingHeartRate} bpm</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
