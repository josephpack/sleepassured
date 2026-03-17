import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";
import { getScheduleHistory, SleepSchedule } from "@/features/diary/api";

interface ChartDataPoint {
  week: string;
  efficiency: number;
  weekNumber: number;
}

export function EfficiencyChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await getScheduleHistory(4);
        const chartData: ChartDataPoint[] = response.schedules
          .filter((s: SleepSchedule) => s.avgSleepEfficiency !== null)
          .map((s: SleepSchedule, index: number) => ({
            week: `Week ${response.schedules.length - index}`,
            efficiency: Math.round(s.avgSleepEfficiency!),
            weekNumber: response.schedules.length - index,
          }))
          .reverse();

        setData(chartData);
      } catch (error) {
        console.error("Failed to load efficiency history:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-14">
        <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
        <p className="text-xs text-muted-foreground mt-3">Loading trends...</p>
      </div>
    );
  }

  if (data.length < 2) {
    return null; // Don't show chart with less than 2 data points
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display text-base font-semibold tracking-tight text-white">
          Efficiency Trend
        </h3>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 12, left: -8, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsla(220, 40%, 100%, 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "hsl(220 15% 55%)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "hsl(220 15% 55%)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const value = payload[0]?.value as number;
                  return (
                    <div className="glass-strong rounded-xl p-3 shadow-lg">
                      <p className="text-sm font-semibold">
                        {payload[0]?.payload?.week}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Efficiency: <span className="font-semibold text-foreground">{value}%</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="efficiency"
              stroke="hsl(225 85% 60%)"
              strokeWidth={2.5}
              dot={{ fill: "hsl(225 85% 60%)", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: "hsl(225 85% 60%)", stroke: "hsl(222 47% 6%)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full eff-bg-excellent" />
          85%+ Excellent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full eff-bg-good" />
          80-84% Good
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full eff-bg-low" />
          &lt;80% Needs work
        </span>
      </div>
    </div>
  );
}
