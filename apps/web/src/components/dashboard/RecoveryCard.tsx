import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, Settings } from "lucide-react";
import {
  getLatestRecovery,
  WhoopRecoveryResponse,
} from "@/features/whoop/api/whoop";

function getRecoveryColor(score: number): string {
  if (score >= 67) return "sa-recovery-green";
  if (score >= 34) return "sa-recovery-yellow";
  return "sa-recovery-red";
}

function getRecoveryBgColor(score: number): string {
  if (score >= 67) return "sa-recovery-bg-green";
  if (score >= 34) return "sa-recovery-bg-yellow";
  return "sa-recovery-bg-red";
}

function getRecoveryLabel(score: number): string {
  if (score >= 67) return "Green";
  if (score >= 34) return "Yellow";
  return "Red";
}

export function RecoveryCard() {
  const [data, setData] = useState<WhoopRecoveryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <Card className="sa-card">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
          <p className="text-xs text-muted-foreground mt-3">Loading recovery...</p>
        </CardContent>
      </Card>
    );
  }

  // Not connected — direct to settings
  if (!data?.connected) {
    return (
      <Card className="sa-card overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1.5">WHOOP Recovery</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Connect your WHOOP to see your recovery score, HRV, and resting
                heart rate.
              </p>
              <Button asChild size="sm" variant="outline" className="rounded-xl">
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Connect WHOOP in Settings
                </Link>
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
      <Card className="sa-card overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="font-display text-lg tracking-tight">
              WHOOP Recovery
            </CardTitle>
          </div>
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
    <Card className="sa-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="font-display text-lg tracking-tight">
            WHOOP Recovery
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl ${bgColorClass} transition-transform hover:scale-105`}
          >
            <span className={`font-display text-2xl font-bold ${colorClass}`}>{score}%</span>
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
          <div className="mt-4 flex gap-4">
            {data.recovery.hrvRmssd && (
              <div className="flex-1 p-3 bg-muted/40 rounded-xl border border-border/30 text-center">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">HRV</p>
                <p className="font-display text-lg font-semibold mt-0.5">{data.recovery.hrvRmssd.toFixed(0)} <span className="text-xs text-muted-foreground font-normal">ms</span></p>
              </div>
            )}
            {data.recovery.restingHeartRate && (
              <div className="flex-1 p-3 bg-muted/40 rounded-xl border border-border/30 text-center">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">RHR</p>
                <p className="font-display text-lg font-semibold mt-0.5">{data.recovery.restingHeartRate} <span className="text-xs text-muted-foreground font-normal">bpm</span></p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
