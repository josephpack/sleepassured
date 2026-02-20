import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Moon, Sun, Activity } from "lucide-react";
import {
  getSleepHistory,
  WhoopSleepHistoryRecord,
} from "@/features/whoop/api/whoop";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function efficiencyColor(eff: number): string {
  if (eff >= 85) return "bg-green-500";
  if (eff >= 75) return "bg-yellow-500";
  return "bg-red-500";
}

function efficiencyTextColor(eff: number): string {
  if (eff >= 85) return "text-green-600";
  if (eff >= 75) return "text-yellow-600";
  return "text-red-600";
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString([], { weekday: "short" });
}

function SleepStageBar({ record }: { record: WhoopSleepHistoryRecord }) {
  const total = record.remMins + record.lightMins + record.deepMins + record.awakeMins;
  if (total === 0) return null;

  const pct = (mins: number) => `${((mins / total) * 100).toFixed(1)}%`;

  return (
    <div className="w-full">
      <div className="flex h-3 rounded-full overflow-hidden">
        <div
          className="bg-purple-500"
          style={{ width: pct(record.remMins) }}
          title={`REM: ${formatDuration(record.remMins)}`}
        />
        <div
          className="bg-blue-400"
          style={{ width: pct(record.lightMins) }}
          title={`Light: ${formatDuration(record.lightMins)}`}
        />
        <div
          className="bg-blue-700"
          style={{ width: pct(record.deepMins) }}
          title={`Deep: ${formatDuration(record.deepMins)}`}
        />
        <div
          className="bg-orange-400"
          style={{ width: pct(record.awakeMins) }}
          title={`Awake: ${formatDuration(record.awakeMins)}`}
        />
      </div>
      <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
          REM {formatDuration(record.remMins)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          Light {formatDuration(record.lightMins)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-700" />
          Deep {formatDuration(record.deepMins)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
          Awake {formatDuration(record.awakeMins)}
        </span>
      </div>
    </div>
  );
}

function LastNightCard({ record }: { record: WhoopSleepHistoryRecord }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Moon className="h-5 w-5 text-primary" />
          Last Night
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Times + totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Moon className="h-3.5 w-3.5" />
              <span className="text-xs">Bedtime</span>
            </div>
            <span className="text-lg font-semibold">{formatTime(record.bedtime)}</span>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Sun className="h-3.5 w-3.5" />
              <span className="text-xs">Wake</span>
            </div>
            <span className="text-lg font-semibold">{formatTime(record.wakeTime)}</span>
          </div>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total sleep</span>
          <span className="font-medium">{formatDuration(record.totalSleepMins)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Sleep efficiency</span>
          <span className={`font-medium ${efficiencyTextColor(record.sleepEfficiency)}`}>
            {record.sleepEfficiency.toFixed(0)}%
          </span>
        </div>

        {record.recoveryScore !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" />
              Recovery
            </span>
            <span className="font-medium">{record.recoveryScore}%</span>
          </div>
        )}

        {/* Sleep stage bar */}
        <SleepStageBar record={record} />
      </CardContent>
    </Card>
  );
}

function WeeklyTrend({ records }: { records: WhoopSleepHistoryRecord[] }) {
  // Show up to 7, oldest first
  const week = records.slice(0, 7).reverse();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">7-Day Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between gap-1">
          {week.map((r) => (
            <div key={r.date} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{dayLabel(r.date)}</span>
              <div className="relative w-full flex justify-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-white ${efficiencyColor(r.sleepEfficiency)}`}
                  title={`${r.date}: ${formatDuration(r.totalSleepMins)}, ${r.sleepEfficiency.toFixed(0)}% eff`}
                >
                  {formatDuration(r.totalSleepMins).replace(/\s/g, "")}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Colour indicates sleep efficiency (green ≥ 85%, yellow ≥ 75%, red &lt; 75%)
        </p>
      </CardContent>
    </Card>
  );
}

export function SleepHistory() {
  const [records, setRecords] = useState<WhoopSleepHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { records: data } = await getSleepHistory(7);
        setRecords(data);
      } catch (error) {
        console.error("Failed to load sleep history:", error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const lastNight = records[0];
  if (!lastNight) return null;

  return (
    <div className="space-y-4">
      <LastNightCard record={lastNight} />
      {records.length > 1 && <WeeklyTrend records={records} />}
    </div>
  );
}
