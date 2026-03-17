import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, Settings } from "lucide-react";
import {
  getLatestRecovery,
  WhoopRecoveryResponse,
} from "@/features/whoop/api/whoop";

function getRecoveryColor(score: number): string {
  if (score >= 67) return "recovery-green";
  if (score >= 34) return "recovery-yellow";
  return "recovery-red";
}

function getRecoveryRingColor(score: number): string {
  if (score >= 67) return "recovery-ring-green";
  if (score >= 34) return "recovery-ring-yellow";
  return "recovery-ring-red";
}

function getRecoveryLabel(score: number): string {
  if (score >= 67) return "Green";
  if (score >= 34) return "Yellow";
  return "Red";
}

function RecoveryRing({ score }: { score: number }) {
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const ringColor = getRecoveryRingColor(score);
  const textColor = getRecoveryColor(score);

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
      <circle
        className={`ring-fill ${ringColor}`}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference}`}
        strokeDashoffset={offset}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className={`font-display font-bold text-base ${textColor}`}
        fill="currentColor"
      >
        {score}%
      </text>
    </svg>
  );
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
      <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
        <p className="text-xs text-muted-foreground mt-3">Loading recovery...</p>
      </div>
    );
  }

  // Not connected — direct to settings
  if (!data?.connected) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1.5 text-white">WHOOP Recovery</h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Connect your WHOOP to see your recovery score, HRV, and resting
              heart rate.
            </p>
            <Button asChild size="sm" variant="outline" className="rounded-xl border-border/60">
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Connect in Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show message if connected but no recovery data yet
  if (!data.recovery) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-display text-base font-semibold tracking-tight text-white">
            WHOOP Recovery
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No recovery data yet. Sync your WHOOP to see your recovery score.
        </p>
      </div>
    );
  }

  const { score } = data.recovery;
  const colorClass = getRecoveryColor(score);
  const label = getRecoveryLabel(score);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display text-base font-semibold tracking-tight">
          WHOOP Recovery
        </h3>
      </div>

      <div className="flex items-center gap-4">
        <RecoveryRing score={score} />
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
        <div className="mt-4 flex gap-3">
          {data.recovery.hrvRmssd && (
            <div className="flex-1 p-3 bg-white/5 rounded-xl text-center">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">HRV</p>
              <p className="font-display text-lg font-semibold mt-0.5">
                {data.recovery.hrvRmssd.toFixed(0)} <span className="text-xs text-muted-foreground font-normal">ms</span>
              </p>
            </div>
          )}
          {data.recovery.restingHeartRate && (
            <div className="flex-1 p-3 bg-white/5 rounded-xl text-center">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">RHR</p>
              <p className="font-display text-lg font-semibold mt-0.5">
                {data.recovery.restingHeartRate} <span className="text-xs text-muted-foreground font-normal">bpm</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
