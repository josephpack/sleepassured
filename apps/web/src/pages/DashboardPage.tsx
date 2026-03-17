import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Moon,
  Sun,
  TrendingUp,
  ChevronRight,
  Loader2,
  Clock,
  Target,
  Sparkles,
  Lock,
  BarChart3,
  CalendarClock,
  AlertTriangle,
  Wifi,
  BookOpen,
  MessageCircle,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCurrentSchedule,
  initializeSchedule,
  CurrentScheduleResponse,
} from "@/features/diary/api";
import { EfficiencyChart } from "@/components/dashboard/EfficiencyChart";
import { RecoveryCard } from "@/components/dashboard/RecoveryCard";
import { SleepHistory } from "@/components/dashboard/SleepHistory";
import { useWhoopAutoSync } from "@/hooks/useWhoopAutoSync";
import { getWhoopStatus } from "@/features/whoop/api/whoop";
import { getCurrentProgramme, ProgrammeResponse } from "@/features/programme/api";

// Format time from HH:MM to display format
function formatTimeDisplay(timeStr: string): string {
  const parts = timeStr.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

// Calculate hours and minutes from total minutes
function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (minutes === 0) return `${hours} hours`;
  return `${hours}h ${minutes}m`;
}

// Get adjustment description
function getAdjustmentDescription(
  adjustment: string | null,
  mins: number
): string | null {
  if (!adjustment || adjustment === "BASELINE") return null;
  if (adjustment === "NONE") return "Maintaining current schedule";
  if (adjustment === "INCREASE") return `Increased by ${mins} minutes`;
  if (adjustment === "DECREASE") return `Decreased by ${mins} minutes`;
  return null;
}

// Time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Circular progress ring component
function EfficiencyRing({ value, size = 80 }: { value: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const colorClass = value >= 85 ? "eff-ring-excellent" : value >= 75 ? "eff-ring-good" : "eff-ring-low";
  const textColor = value >= 85 ? "eff-excellent" : value >= 75 ? "eff-good" : "eff-low";

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        className="ring-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      <circle
        className={`ring-fill ${colorClass}`}
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
        className={`font-display font-bold text-lg ${textColor}`}
        fill="currentColor"
      >
        {value.toFixed(0)}%
      </text>
    </svg>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { needsReauth } = useWhoopAutoSync();
  const [scheduleData, setScheduleData] = useState<CurrentScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [whoopConnected, setWhoopConnected] = useState<boolean | null>(null);
  const [programme, setProgramme] = useState<ProgrammeResponse | null>(null);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  // Load completed actions from localStorage when programme loads
  useEffect(() => {
    if (!programme) return;
    try {
      const stored = localStorage.getItem("sleepassured_actions_completed");
      if (stored) {
        const parsed: Record<string, boolean> = JSON.parse(stored);
        const currentIds = new Set(programme.dailyActions.map((a) => a.id));
        const filtered = new Set(
          Object.keys(parsed).filter((id) => currentIds.has(id))
        );
        setCompletedActions(filtered);
        // Clean stale entries
        const cleaned: Record<string, boolean> = {};
        for (const id of filtered) cleaned[id] = true;
        localStorage.setItem("sleepassured_actions_completed", JSON.stringify(cleaned));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [programme]);

  const toggleAction = (actionId: string) => {
    setCompletedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      try {
        const obj: Record<string, boolean> = {};
        for (const id of next) obj[id] = true;
        localStorage.setItem("sleepassured_actions_completed", JSON.stringify(obj));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [schedData, whoopStatus] = await Promise.all([
          getCurrentSchedule(),
          getWhoopStatus(),
        ]);
        setScheduleData(schedData);
        setWhoopConnected(whoopStatus.connected);

        // Load programme data if schedule exists
        if (schedData.hasSchedule) {
          try {
            const prog = await getCurrentProgramme();
            setProgramme(prog);
          } catch (error) {
            console.error("Failed to load programme:", error);
          }
        }
      } catch (error) {
        console.error("Failed to load schedule:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (user?.onboardingCompleted) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [user?.onboardingCompleted]);

  const handleInitializeSchedule = async () => {
    setIsInitializing(true);
    try {
      const result = await initializeSchedule();
      toast.success("Your sleep schedule is ready!");
      setScheduleData({
        hasSchedule: true,
        schedule: result.schedule,
      });
    } catch (error: unknown) {
      console.error("Initialize error:", error);
      const message = error instanceof Error ? error.message : "Failed to create schedule";
      toast.error(message);
    } finally {
      setIsInitializing(false);
    }
  };

  const schedule = scheduleData?.schedule;
  const baselineStatus = scheduleData?.baselineStatus;
  const hasSchedule = scheduleData?.hasSchedule;
  const isBaseline = !isLoading && !hasSchedule && !!baselineStatus;
  const isFirstTime = !isLoading && !hasSchedule && !baselineStatus;
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="px-4 pt-6">
      <div className="mx-auto max-w-lg">
        {/* Header — time-based greeting */}
        <div className="mb-6 animate-fade-up">
          <p className="text-sm text-muted-foreground font-medium">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">
            {hasSchedule && schedule?.weekNumber
              ? `Week ${schedule.weekNumber}`
              : "Your Sleep"}
          </h1>
        </div>

        {/* WHOOP reconnect banner */}
        {needsReauth && (
          <div className="mb-5 animate-fade-up stagger-1 glass-card rounded-2xl p-4 border-l-2" style={{ borderLeftColor: "hsl(38 80% 55%)" }}>
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">WHOOP needs refreshing</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sleep data syncing is paused.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0 rounded-xl text-xs border-border/60">
                <Link to="/settings">Reconnect</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Onboarding CTA for users who haven't completed onboarding */}
        {!user?.onboardingCompleted && (
          <div className="mb-5 animate-fade-up stagger-1 glass-card rounded-2xl overflow-hidden">
            <div className="gradient-card p-5">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Welcome, {firstName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Complete onboarding to start your sleep improvement journey
              </p>
              <Button asChild className="rounded-xl">
                <Link to="/onboarding">
                  Complete Onboarding
                  <ChevronRight className="h-4 w-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {user?.onboardingCompleted && (
          <>
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-2 border-primary/20" />
                  <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0" />
                </div>
                <p className="text-sm text-muted-foreground mt-4 font-medium">Loading your dashboard...</p>
              </div>
            )}

            {!isLoading && (
              <div className="space-y-4">
                {/* Hero Card — pre-schedule states */}
                {!hasSchedule && (
                  <div className="animate-fade-up stagger-1 glass-card rounded-2xl overflow-hidden">
                    <div className="gradient-card p-5">
                      <div className="flex items-start gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 animate-float">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="font-display text-lg font-semibold mb-1.5 tracking-tight">
                            AI Sleep Coach, Powered by Real Data
                          </h2>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            SleepAssured combines your WHOOP sleep data with AI trained on CBT-i
                            principles to create a personalised programme.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* First-time user — connect WHOOP or waiting for data */}
                {isFirstTime && (
                  <div className="animate-fade-up stagger-2 glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Wifi className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display text-base font-semibold tracking-tight">
                        {whoopConnected ? "Waiting for Sleep Data" : "Connect WHOOP to Get Started"}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {whoopConnected
                        ? "We're automatically collecting your sleep data from WHOOP. We need 7 nights to understand your patterns and build your personalised schedule."
                        : "Connect your WHOOP to start tracking sleep automatically. We need 7 nights of data to build your personalised schedule."}
                    </p>
                    {!whoopConnected && (
                      <Button asChild className="rounded-xl">
                        <Link to="/settings">
                          Connect WHOOP
                          <ChevronRight className="h-4 w-4 ml-1.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                )}

                {/* Baseline Progress */}
                {isBaseline && (
                  <div className="animate-fade-up stagger-2 glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display text-base font-semibold tracking-tight">
                        Building Your Baseline
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      We're automatically collecting your sleep data. We need 7 nights
                      to build your personalised schedule.
                    </p>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground text-xs">Progress</span>
                        <span className="font-semibold text-xs">
                          {baselineStatus.entriesLogged} of 7 nights
                        </span>
                      </div>
                      <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-primary rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.min(100, (baselineStatus.entriesLogged / 7) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-4">
                      {baselineStatus.message}
                    </p>

                    {/* Initialize button when baseline is complete */}
                    {baselineStatus.isComplete && (
                      <Button onClick={handleInitializeSchedule} disabled={isInitializing} className="rounded-xl w-full">
                        {isInitializing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Get My Sleep Schedule
                      </Button>
                    )}
                  </div>
                )}

                {/* ═══════ Sleep Window Hero ═══════ */}
                {hasSchedule && schedule && (
                  <div className="animate-fade-up stagger-1 rounded-2xl overflow-hidden">
                    <div className="glass-card gradient-card p-5">
                      {/* Bedtime / Wake row */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex-1 text-center">
                          <div className="flex items-center justify-center gap-1.5 mb-1.5">
                            <Moon className="h-3.5 w-3.5 text-[hsl(260,40%,65%)]" />
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Bedtime</span>
                          </div>
                          <span className="font-display text-3xl font-semibold tracking-tight">
                            {formatTimeDisplay(schedule.prescribedBedtime)}
                          </span>
                        </div>

                        {/* Circular efficiency ring in center */}
                        {schedule.avgSleepEfficiency !== null && (
                          <div className="mx-3">
                            <EfficiencyRing value={schedule.avgSleepEfficiency} size={76} />
                          </div>
                        )}

                        <div className="flex-1 text-center">
                          <div className="flex items-center justify-center gap-1.5 mb-1.5">
                            <Sun className="h-3.5 w-3.5 text-accent" />
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Wake</span>
                          </div>
                          <span className="font-display text-3xl font-semibold tracking-tight">
                            {formatTimeDisplay(schedule.prescribedWakeTime)}
                          </span>
                        </div>
                      </div>

                      {/* Duration + metrics row */}
                      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(schedule.timeInBedMins)} in bed</span>
                        </div>
                        {schedule.adherencePercentage !== null && (
                          <div className="flex items-center gap-1.5">
                            <Target className="h-3 w-3" />
                            <span>{schedule.adherencePercentage}% adherence</span>
                          </div>
                        )}
                      </div>

                      {/* Adjustment info */}
                      {schedule.adjustmentMade && schedule.adjustmentMade !== "BASELINE" && (
                        <div className="flex items-center justify-center gap-2 text-xs mt-3 text-primary">
                          <TrendingUp className="h-3 w-3" />
                          <span className="font-medium">
                            {getAdjustmentDescription(schedule.adjustmentMade, schedule.adjustmentMins)}
                          </span>
                        </div>
                      )}

                      {/* Feedback message */}
                      {schedule.feedbackMessage && (
                        <div className="mt-4 p-3.5 bg-glass rounded-xl border border-glass">
                          <p className="text-xs leading-relaxed text-muted-foreground">{schedule.feedbackMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ═══════ Programme / Coach Card ═══════ */}
                {programme ? (
                  <div className="animate-fade-up stagger-2 glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate">
                          Week {programme.progress.currentWeek} of {programme.totalWeeks}: {programme.topic}
                        </h3>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-primary rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${(programme.progress.currentWeek / programme.totalWeeks) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {programme.progress.currentWeek} of {programme.totalWeeks} weeks completed
                      </p>
                    </div>

                    {/* Daily nudge */}
                    <div className="rounded-xl bg-primary/5 border border-primary/8 p-3.5 mb-4">
                      <p className="text-sm leading-relaxed">{programme.dailyNudge.message}</p>
                    </div>

                    {/* This week's actions */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This week's actions</h4>
                        <span className="text-xs text-muted-foreground font-medium tabular-nums">
                          {completedActions.size}/{programme.dailyActions.length}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {programme.dailyActions.map((action) => {
                          const done = completedActions.has(action.id);
                          return (
                            <li key={action.id}>
                              <button
                                type="button"
                                onClick={() => toggleAction(action.id)}
                                className={`flex items-start gap-2.5 w-full text-left p-2.5 rounded-xl transition-all duration-200 ${
                                  done ? "bg-primary/5" : "hover:bg-muted/40"
                                }`}
                              >
                                {done ? (
                                  <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0 mt-px" />
                                ) : (
                                  <Circle className="h-[18px] w-[18px] text-muted-foreground/30 shrink-0 mt-px" />
                                )}
                                <span
                                  className={`text-sm leading-relaxed transition-colors ${
                                    done
                                      ? "line-through text-muted-foreground/40"
                                      : "text-foreground/80"
                                  }`}
                                >
                                  {action.text}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Talk to Coach button */}
                    <Button asChild className="w-full rounded-xl h-11">
                      <Link to="/chat">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Talk to Your Coach
                      </Link>
                    </Button>
                  </div>
                ) : (
                  hasSchedule && (
                    <div className="animate-fade-up stagger-2 glass-card rounded-2xl p-5">
                      <div className="flex items-start gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 animate-float">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1.5">Your AI Sleep Coach</h3>
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                            Get personalised advice based on your real sleep
                            data and CBT-i principles.
                          </p>
                          <Button asChild className="rounded-xl">
                            <Link to="/chat">
                              Chat with Your Coach
                              <ChevronRight className="h-4 w-4 ml-1.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Sleep History */}
                <div className="animate-fade-up stagger-3">
                  <SleepHistory />
                </div>

                {/* Efficiency Chart (post-baseline) */}
                {hasSchedule && (
                  <div className="animate-fade-up stagger-4">
                    <EfficiencyChart />
                  </div>
                )}

                {/* WHOOP Recovery Card */}
                {hasSchedule && (
                  <div className="animate-fade-up stagger-5">
                    <RecoveryCard />
                  </div>
                )}

                {/* Coming Soon cards — show during baseline */}
                {!hasSchedule && (
                  <div className="space-y-4">
                    <div className="animate-fade-up stagger-3 glass-card rounded-2xl p-5 opacity-50">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                          <CalendarClock className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-muted-foreground text-sm">Sleep Schedule</h3>
                            <Lock className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Once we have enough data, you'll receive a personalised sleep
                            window designed using CBT-i sleep restriction principles.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="animate-fade-up stagger-4 glass-card rounded-2xl p-5 opacity-50">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                          <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-muted-foreground text-sm">Sleep Trends</h3>
                            <Lock className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Track your sleep efficiency over time and see your patterns
                            improve week by week.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* WHOOP Recovery during baseline — show if connected */}
                    <div className="animate-fade-up stagger-5">
                      <RecoveryCard />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
