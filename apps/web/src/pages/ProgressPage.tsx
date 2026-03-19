import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Moon,
  Heart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────

interface DailyDataPoint {
  date: string;
  sleepEfficiency: number;
  totalSleepMins: number;
  source: string;
}

interface RecoveryDataPoint {
  date: string;
  recoveryScore: number | null;
  hrvRmssd: number | null;
  restingHeartRate: number | null;
}

interface ScheduleWeek {
  weekNumber: number;
  weekStartDate: string;
  prescribedBedtime: string;
  prescribedWakeTime: string;
  timeInBedMins: number;
  avgSleepEfficiency: number | null;
  adjustmentMade: string | null;
  adjustmentMins: number;
}

interface ISIEntry {
  score: number;
  severity: string;
  completedAt: string;
}

interface ProgressSummary {
  firstWeekAvgEfficiency: number | null;
  latestWeekAvgEfficiency: number | null;
  efficiencyChange: number | null;
  firstWeekAvgTST: number | null;
  latestWeekAvgTST: number | null;
  tstChange: number | null;
  avgRecovery: number | null;
  latestRecovery: number | null;
}

interface ProgressData {
  programmeWeek: number;
  totalWeeks: number;
  therapyStartDate: string | null;
  memberSince: string | null;
  totalNights: number;
  dailyData: DailyDataPoint[];
  recoveryData: RecoveryDataPoint[];
  schedules: ScheduleWeek[];
  isiHistory: ISIEntry[];
  summary: ProgressSummary;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function chartDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function severityLabel(severity: string): string {
  switch (severity) {
    case "none": return "No clinical insomnia";
    case "subthreshold": return "Mild insomnia";
    case "moderate": return "Moderate insomnia";
    case "severe": return "Severe insomnia";
    default: return severity;
  }
}

function severityColour(severity: string): string {
  switch (severity) {
    case "none": return "text-[hsl(var(--sage))]";
    case "subthreshold": return "text-[hsl(var(--gold))]";
    case "moderate": return "text-[hsl(var(--primary))]";
    case "severe": return "text-[hsl(16,52%,52%)]";
    default: return "text-muted-foreground";
  }
}

function adjustmentIcon(adj: string | null) {
  if (adj === "INCREASE") return <ChevronUp className="h-3.5 w-3.5 text-[hsl(var(--sage))]" />;
  if (adj === "DECREASE") return <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function adjustmentLabel(adj: string | null, mins: number): string {
  if (adj === "INCREASE") return `+${mins}m`;
  if (adj === "DECREASE") return `-${mins}m`;
  if (adj === "BASELINE") return "Baseline";
  return "No change";
}

// ─── Chart tooltip ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTooltip(valueKey: string, unit: string, fmt?: (v: number) => string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function TooltipContent(props: any) {
    const { active, payload } = props;
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    const value = data?.[valueKey] as number;
    if (value == null) return null;
    return (
      <div className="surface-elevated rounded-xl p-3 shadow-lg">
        <p className="text-xs text-muted-foreground">{shortDate(data?.date as string)}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">
          {fmt ? fmt(value) : value}{unit}
        </p>
      </div>
    );
  };
}

const EffTooltip = makeTooltip("sleepEfficiency", "%");
const TSTTooltip = makeTooltip("totalSleepHours", "h", (v) => v.toFixed(1));
const RecoveryTooltip = makeTooltip("recoveryScore", "%");

// ─── Stat card ───────────────────────────────────────────────────

function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
}: {
  label: string;
  value: string;
  change: number | null;
  changeLabel?: string;
  icon: React.ElementType;
}) {
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;

  return (
    <div className="surface-card rounded-2xl p-4 flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">{label}</span>
      </div>
      <p className="text-[22px] font-medium text-foreground leading-none">{value}</p>
      {change !== null && (
        <div className="flex items-center gap-1 mt-2">
          {isPositive && <ArrowUpRight className="h-3 w-3 text-[hsl(var(--sage))]" />}
          {isNegative && <ArrowDownRight className="h-3 w-3 text-[hsl(var(--primary))]" />}
          {!isPositive && !isNegative && <Minus className="h-3 w-3 text-muted-foreground" />}
          <span
            className={`text-xs font-medium ${
              isPositive ? "text-[hsl(var(--sage))]" : isNegative ? "text-[hsl(var(--primary))]" : "text-muted-foreground"
            }`}
          >
            {isPositive ? "+" : ""}
            {changeLabel ?? change}
          </span>
          <span className="text-[10px] text-muted-foreground ml-0.5">vs first week</span>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────

export function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const progress = await api<ProgressData>("/progress");
        setData(progress);
      } catch (error) {
        console.error("Failed to load progress data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="px-5 pt-14">
        <div className="mx-auto max-w-lg flex flex-col items-center justify-center py-20 animate-fade-in">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground mt-4 font-medium">Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalNights === 0) {
    return (
      <div className="px-5 pt-14">
        <div className="mx-auto max-w-lg">
          <h1 className="text-[22px] font-medium text-foreground mb-2">Progress</h1>
          <div className="surface-card rounded-2xl p-6 text-center mt-6">
            <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">No data yet</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Your progress will appear here once your device has synced a few nights of sleep data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { summary, dailyData, recoveryData, schedules, isiHistory, programmeWeek, totalWeeks, totalNights } = data;

  // Thin daily data for chart readability — show last 30 days max
  const chartDailyData = dailyData.slice(-30);
  // Convert TST to hours for chart
  const tstChartData = chartDailyData.map((d) => ({
    ...d,
    totalSleepHours: +(d.totalSleepMins / 60).toFixed(1),
  }));
  const recoveryChartData = recoveryData.filter((r) => r.recoveryScore != null).slice(-30);
  const hasRecovery = recoveryChartData.length > 0;

  // Tick interval: show ~6 labels max
  const tickInterval = Math.max(1, Math.floor(chartDailyData.length / 6));

  return (
    <div className="px-5 pt-14 pb-28">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-5 animate-fade-up">
          <h1 className="text-[22px] font-medium text-foreground">Progress</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[13px] text-muted-foreground">
              {totalNights} night{totalNights !== 1 ? "s" : ""} tracked
            </span>
            {programmeWeek > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[13px] text-[hsl(var(--gold))]">
                  Week {programmeWeek} of {totalWeeks}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ═══ Summary cards ═══ */}
        <div className="flex gap-2.5 mb-4 animate-fade-up stagger-1">
          <StatCard
            label="Efficiency"
            value={summary.latestWeekAvgEfficiency != null ? `${summary.latestWeekAvgEfficiency}%` : "—"}
            change={summary.efficiencyChange}
            changeLabel={summary.efficiencyChange != null ? `${summary.efficiencyChange > 0 ? "+" : ""}${summary.efficiencyChange}%` : undefined}
            icon={TrendingUp}
          />
          <StatCard
            label="Sleep"
            value={summary.latestWeekAvgTST != null ? formatDuration(summary.latestWeekAvgTST) : "—"}
            change={summary.tstChange}
            changeLabel={summary.tstChange != null ? `${summary.tstChange > 0 ? "+" : ""}${formatDuration(Math.abs(summary.tstChange))}` : undefined}
            icon={Moon}
          />
          {hasRecovery && (
            <StatCard
              label="Recovery"
              value={summary.latestRecovery != null ? `${summary.latestRecovery}%` : "—"}
              change={null}
              icon={Heart}
            />
          )}
        </div>

        {/* ═══ Sleep efficiency chart ═══ */}
        {chartDailyData.length >= 3 && (
          <div className="surface-card rounded-2xl p-5 mb-3 animate-fade-up stagger-2">
            <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-4">
              Sleep efficiency
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartDailyData} margin={{ top: 5, right: 8, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(33, 20%, 100%, 0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(33 15% 55%)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={chartDateLabel}
                    interval={tickInterval}
                  />
                  <YAxis
                    domain={[40, 100]}
                    tick={{ fontSize: 10, fill: "hsl(33 15% 55%)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <ReferenceLine
                    y={85}
                    stroke="hsl(155 25% 45%)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                  <Tooltip content={<EffTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="sleepEfficiency"
                    stroke="hsl(16 52% 62%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: "hsl(16 52% 62%)", stroke: "hsl(30 8% 7%)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-muted-foreground/60">
              <span className="inline-block w-4 border-t border-dashed border-[hsl(155,25%,45%)]" />
              85% target
            </div>
          </div>
        )}

        {/* ═══ Total sleep time chart ═══ */}
        {tstChartData.length >= 3 && (
          <div className="surface-card rounded-2xl p-5 mb-3 animate-fade-up stagger-2">
            <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-4">
              Total sleep time
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tstChartData} margin={{ top: 5, right: 8, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(33, 20%, 100%, 0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(33 15% 55%)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={chartDateLabel}
                    interval={tickInterval}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(33 15% 55%)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <Tooltip content={<TSTTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="totalSleepHours"
                    stroke="hsl(36 55% 51%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: "hsl(36 55% 51%)", stroke: "hsl(30 8% 7%)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ Recovery trend (WHOOP) ═══ */}
        {recoveryChartData.length >= 3 && (
          <div className="surface-card rounded-2xl p-5 mb-3 animate-fade-up stagger-3">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest">
                Recovery
              </h3>
              <span className="text-[10px] text-muted-foreground/50">WHOOP</span>
            </div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recoveryChartData} margin={{ top: 5, right: 8, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(33, 20%, 100%, 0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(33 15% 55%)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={chartDateLabel}
                    interval={Math.max(1, Math.floor(recoveryChartData.length / 6))}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "hsl(33 15% 55%)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<RecoveryTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="recoveryScore"
                    stroke="hsl(155 25% 55%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: "hsl(155 25% 55%)", stroke: "hsl(30 8% 7%)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ Sleep window progression ═══ */}
        {schedules.length > 0 && (
          <div className="surface-card rounded-2xl p-5 mb-3 animate-fade-up stagger-3">
            <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-4">
              Sleep window history
            </h3>
            <div className="space-y-0">
              {schedules.map((week, i) => {
                const isLatest = i === schedules.length - 1;
                return (
                  <div key={week.weekNumber} className="relative flex items-start gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center shrink-0 w-5">
                      <div
                        className={`h-2.5 w-2.5 rounded-full mt-1.5 ${
                          isLatest ? "bg-[hsl(var(--gold))]" : "bg-muted-foreground/30"
                        }`}
                      />
                      {i < schedules.length - 1 && (
                        <div className="w-px flex-1 bg-border/40 min-h-[2rem]" />
                      )}
                    </div>
                    {/* Content */}
                    <div className={`flex-1 pb-4 ${i < schedules.length - 1 ? "" : "pb-0"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${isLatest ? "text-foreground" : "text-muted-foreground"}`}>
                          Week {week.weekNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {week.adjustmentMade && week.adjustmentMade !== "BASELINE" && (
                            <>
                              {adjustmentIcon(week.adjustmentMade)}
                              <span className="text-xs text-muted-foreground">
                                {adjustmentLabel(week.adjustmentMade, week.adjustmentMins)}
                              </span>
                            </>
                          )}
                          {week.adjustmentMade === "BASELINE" && (
                            <span className="text-xs text-muted-foreground">Baseline</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {week.prescribedBedtime}–{week.prescribedWakeTime}
                        </span>
                        <span>{formatDuration(week.timeInBedMins)}</span>
                        {week.avgSleepEfficiency != null && (
                          <span className="text-foreground/60">
                            {Math.round(week.avgSleepEfficiency)}% eff
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ Insomnia score (ISI) ═══ */}
        {isiHistory.length > 0 && (
          <div className="surface-card rounded-2xl p-5 mb-3 animate-fade-up stagger-4">
            <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">
              Insomnia score
            </h3>
            <p className="text-[11px] text-muted-foreground/60 mb-4">
              Based on the Insomnia Severity Index questionnaire
            </p>

            {isiHistory.length === 1 ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-medium text-foreground">{isiHistory[0]!.score}</span>
                  <span className="text-sm text-muted-foreground">/28</span>
                </div>
                <p className={`text-sm font-medium mt-1 ${severityColour(isiHistory[0]!.severity)}`}>
                  {severityLabel(isiHistory[0]!.severity)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Taken {shortDate(isiHistory[0]!.completedAt)}
                </p>
              </div>
            ) : (
              <div className="flex gap-4">
                {/* First assessment */}
                <div className="flex-1 p-3 bg-surface rounded-xl">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Start</p>
                  <p className="text-xl font-medium text-foreground">
                    {isiHistory[0]!.score}<span className="text-xs text-muted-foreground font-normal">/28</span>
                  </p>
                  <p className={`text-xs mt-0.5 ${severityColour(isiHistory[0]!.severity)}`}>
                    {severityLabel(isiHistory[0]!.severity)}
                  </p>
                </div>
                {/* Latest assessment */}
                <div className="flex-1 p-3 bg-surface rounded-xl">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Latest</p>
                  <p className="text-xl font-medium text-foreground">
                    {isiHistory[isiHistory.length - 1]!.score}<span className="text-xs text-muted-foreground font-normal">/28</span>
                  </p>
                  <p className={`text-xs mt-0.5 ${severityColour(isiHistory[isiHistory.length - 1]!.severity)}`}>
                    {severityLabel(isiHistory[isiHistory.length - 1]!.severity)}
                  </p>
                </div>
                {/* Change */}
                {isiHistory.length >= 2 && (() => {
                  const change = isiHistory[isiHistory.length - 1]!.score - isiHistory[0]!.score;
                  const improved = change < 0;
                  return (
                    <div className="flex flex-col items-center justify-center px-2">
                      {improved ? (
                        <TrendingDown className="h-5 w-5 text-[hsl(var(--sage))]" />
                      ) : change === 0 ? (
                        <Minus className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-[hsl(var(--primary))]" />
                      )}
                      <span
                        className={`text-sm font-semibold mt-1 ${
                          improved ? "text-[hsl(var(--sage))]" : change === 0 ? "text-muted-foreground" : "text-[hsl(var(--primary))]"
                        }`}
                      >
                        {change > 0 ? "+" : ""}{change}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ═══ HRV & RHR mini stats ═══ */}
        {recoveryData.length > 0 && (() => {
          const recent = recoveryData.slice(-7);
          const avgHrv = recent.filter((r) => r.hrvRmssd != null);
          const avgRhr = recent.filter((r) => r.restingHeartRate != null);
          const hrvValue = avgHrv.length > 0
            ? Math.round(avgHrv.reduce((s, r) => s + r.hrvRmssd!, 0) / avgHrv.length)
            : null;
          const rhrValue = avgRhr.length > 0
            ? Math.round(avgRhr.reduce((s, r) => s + r.restingHeartRate!, 0) / avgRhr.length)
            : null;
          if (hrvValue === null && rhrValue === null) return null;
          return (
            <div className="flex gap-2.5 mb-3 animate-fade-up stagger-4">
              {hrvValue !== null && (
                <div className="surface-card rounded-2xl p-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">HRV</span>
                  </div>
                  <p className="text-[22px] font-medium text-foreground">
                    {hrvValue}<span className="text-xs text-muted-foreground font-normal ml-1">ms</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">7-day average</p>
                </div>
              )}
              {rhrValue !== null && (
                <div className="surface-card rounded-2xl p-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Resting HR</span>
                  </div>
                  <p className="text-[22px] font-medium text-foreground">
                    {rhrValue}<span className="text-xs text-muted-foreground font-normal ml-1">bpm</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">7-day average</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
