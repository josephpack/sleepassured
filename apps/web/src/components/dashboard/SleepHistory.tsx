import { useEffect, useState } from "react";
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
  if (eff >= 85) return "eff-bg-excellent";
  if (eff >= 75) return "eff-bg-good";
  return "eff-bg-low";
}

function efficiencyTextColor(eff: number): string {
  if (eff >= 85) return "eff-excellent";
  if (eff >= 75) return "eff-good";
  return "eff-low";
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
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        <div
          className="stage-rem rounded-l-full"
          style={{ width: pct(record.remMins) }}
          title={`REM: ${formatDuration(record.remMins)}`}
        />
        <div
          className="stage-light"
          style={{ width: pct(record.lightMins) }}
          title={`Light: ${formatDuration(record.lightMins)}`}
        />
        <div
          className="stage-deep"
          style={{ width: pct(record.deepMins) }}
          title={`Deep: ${formatDuration(record.deepMins)}`}
        />
        <div
          className="stage-awake rounded-r-full"
          style={{ width: pct(record.awakeMins) }}
          title={`Awake: ${formatDuration(record.awakeMins)}`}
        />
      </div>
      <div className="flex gap-3 mt-2.5 text-[11px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full dot-rem" />
          REM {formatDuration(record.remMins)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full dot-light" />
          Light {formatDuration(record.lightMins)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full dot-deep" />
          Deep {formatDuration(record.deepMins)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full dot-awake" />
          Awake {formatDuration(record.awakeMins)}
        </span>
      </div>
    </div>
  );
}

function LastNightCard({ record }: { record: WhoopSleepHistoryRecord }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-[hsla(260,40%,65%,0.12)] flex items-center justify-center">
          <Moon className="h-4 w-4 text-[hsl(260,40%,65%)]" />
        </div>
        <h3 className="font-display text-base font-semibold tracking-tight text-white">Last Night</h3>
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center p-3 bg-white/5 rounded-xl">
          <div className="flex items-center justify-center gap-1.5 text-white/50 mb-1">
            <Moon className="h-3 w-3 text-[hsl(260,40%,65%)]/70" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Bedtime</span>
          </div>
          <span className="font-display text-lg font-semibold text-white">{formatTime(record.bedtime)}</span>
        </div>
        <div className="text-center p-3 bg-white/5 rounded-xl">
          <div className="flex items-center justify-center gap-1.5 text-white/50 mb-1">
            <Sun className="h-3 w-3 text-accent/70" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Wake</span>
          </div>
          <span className="font-display text-lg font-semibold text-white">{formatTime(record.wakeTime)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total sleep</span>
          <span className="font-semibold text-white">{formatDuration(record.totalSleepMins)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Efficiency</span>
          <span className={`font-semibold ${efficiencyTextColor(record.sleepEfficiency)}`}>
            {record.sleepEfficiency.toFixed(0)}%
          </span>
        </div>
        {record.recoveryScore !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Recovery
            </span>
            <span className="font-semibold text-white">{record.recoveryScore}%</span>
          </div>
        )}
      </div>

      {/* Sleep stage bar */}
      <SleepStageBar record={record} />
    </div>
  );
}

function WeeklyTrend({ records }: { records: WhoopSleepHistoryRecord[] }) {
  // Show up to 7, oldest first
  const week = records.slice(0, 7).reverse();

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-white mb-4">7-Day Trend</h3>
      <div className="flex justify-between gap-1">
        {week.map((r) => (
          <div
            key={r.date}
            className="flex flex-col items-center gap-1.5 flex-1"
            title={`${r.date}: ${formatDuration(r.totalSleepMins)}, ${r.sleepEfficiency.toFixed(0)}% efficiency`}
          >
            <span className="text-[10px] text-muted-foreground font-medium">{dayLabel(r.date)}</span>
            <div className={`h-3 w-3 rounded-full ${efficiencyColor(r.sleepEfficiency)} transition-transform hover:scale-125`} />
            <span className="text-xs font-semibold text-white">{formatDuration(r.totalSleepMins)}</span>
            <span className="text-[10px] text-muted-foreground">{r.sleepEfficiency.toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/50 text-center mt-3 tracking-wide">
        Colour indicates sleep efficiency: green 85%+, amber 75%+, red below 75%
      </p>
    </div>
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
      <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
        <p className="text-xs text-muted-foreground mt-3">Loading sleep data...</p>
      </div>
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
