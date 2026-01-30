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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (data.length < 2) {
    return null; // Don't show chart with less than 2 data points
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Sleep Efficiency Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const value = payload[0]?.value as number;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <p className="text-sm font-medium">
                          {payload[0]?.payload?.week}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Efficiency: <span className="font-medium">{value}%</span>
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
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            85%+ Excellent
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
            80-84% Good
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            &lt;80% Needs work
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
