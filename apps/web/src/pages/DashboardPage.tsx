import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  Settings,
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

  return (
    <div className="px-4 pb-10 pt-3">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 sa-animate-in">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight truncate">
              SleepAssured
            </h1>
            {schedule?.weekNumber && (
              <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary whitespace-nowrap">
                Week {schedule.weekNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {user?.name && (
              <span className="text-sm text-muted-foreground hidden sm:inline font-medium">
                {user.name.split(" ")[0]}
              </span>
            )}
            <Button variant="ghost" size="icon" asChild className="h-10 w-10 rounded-xl hover:bg-primary/5 transition-colors">
              <Link to="/settings">
                <Settings className="h-[18px] w-[18px] text-muted-foreground" />
              </Link>
            </Button>
          </div>
        </div>

        {/* WHOOP reconnect banner */}
        {needsReauth && (
          <div className="mb-6 sa-animate-in sa-stagger-1 rounded-xl border border-amber/30 bg-amber-soft/50 p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">WHOOP connection needs refreshing</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Sleep data syncing is paused until you reconnect.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0 rounded-lg">
                <Link to="/settings">Reconnect</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Onboarding CTA for users who haven't completed onboarding */}
        {!user?.onboardingCompleted && (
          <Card className="mb-6 sa-animate-in sa-stagger-1 sa-card overflow-hidden">
            <div className="sa-gradient-dusk">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-xl">
                  Welcome, {user?.name?.split(" ")[0]}
                </CardTitle>
                <CardDescription className="text-sm">
                  Complete onboarding to start your sleep improvement journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="rounded-xl">
                  <Link to="/onboarding">
                    Complete Onboarding
                    <ChevronRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              </CardContent>
            </div>
          </Card>
        )}

        {user?.onboardingCompleted && (
          <>
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 sa-animate-fade">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-2 border-primary/20" />
                  <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0" />
                </div>
                <p className="text-sm text-muted-foreground mt-4 font-medium">Loading your dashboard...</p>
              </div>
            )}

            {!isLoading && (
              <div className="space-y-5">
                {/* Hero Card — show during baseline / first-time */}
                {!hasSchedule && (
                  <Card className="sa-card sa-animate-in sa-stagger-1 overflow-hidden border-primary/15">
                    <div className="sa-gradient-dusk">
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-start gap-4">
                          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 sa-animate-float">
                            <Sparkles className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h2 className="font-display text-lg font-semibold mb-1.5 tracking-tight">
                              Your AI Sleep Coach, Powered by Real Data
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              SleepAssured combines your WHOOP sleep data with AI trained on CBT-i
                              principles to create a personalised programme to help you overcome
                              insomnia.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                )}

                {/* First-time user — connect WHOOP or waiting for data */}
                {isFirstTime && (
                  <Card className="sa-card sa-animate-in sa-stagger-2 overflow-hidden">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
                          <Wifi className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="font-display text-lg tracking-tight">
                            {whoopConnected ? "Waiting for Sleep Data" : "Connect WHOOP to Get Started"}
                          </CardTitle>
                        </div>
                      </div>
                      <CardDescription className="mt-2">
                        {whoopConnected
                          ? "We're automatically collecting your sleep data from WHOOP. We need 7 nights to understand your patterns and build your personalised schedule."
                          : "Connect your WHOOP to start tracking sleep automatically. We need 7 nights of data to build your personalised schedule."}
                      </CardDescription>
                    </CardHeader>
                    {!whoopConnected && (
                      <CardContent>
                        <Button asChild size="lg" className="rounded-xl">
                          <Link to="/settings">
                            Connect WHOOP
                            <ChevronRight className="h-4 w-4 ml-1.5" />
                          </Link>
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Baseline Progress */}
                {isBaseline && (
                  <Card className="sa-card sa-animate-in sa-stagger-2 overflow-hidden">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="font-display text-lg tracking-tight">
                            Building Your Baseline
                          </CardTitle>
                        </div>
                      </div>
                      <CardDescription className="mt-2">
                        We're automatically collecting your sleep data. We need 7 nights
                        to understand your patterns and build your personalised schedule.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2.5">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-semibold text-foreground">
                            {baselineStatus.entriesLogged} of 7 nights
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden sa-progress-bar">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${Math.min(100, (baselineStatus.entriesLogged / 7) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4">
                        {baselineStatus.message}
                      </p>

                      {/* Initialize button when baseline is complete */}
                      {baselineStatus.isComplete && (
                        <Button onClick={handleInitializeSchedule} disabled={isInitializing} className="rounded-xl">
                          {isInitializing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Get My Sleep Schedule
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Sleep Window Display (post-baseline) */}
                {hasSchedule && schedule && (
                  <Card className="sa-card sa-animate-in sa-stagger-1 overflow-hidden border-primary/15">
                    <div className="sa-gradient-dusk">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="font-display text-lg tracking-tight">
                              Your Sleep Window
                            </CardTitle>
                            <CardDescription className="mt-0.5">
                              Follow this schedule for better sleep
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
                          <div className="text-center p-4 sm:p-5 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                              <Moon className="h-4 w-4 text-lavender" />
                              <span className="text-xs font-medium uppercase tracking-wider">Bedtime</span>
                            </div>
                            <span className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                              {formatTimeDisplay(schedule.prescribedBedtime)}
                            </span>
                          </div>
                          <div className="text-center p-4 sm:p-5 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                              <Sun className="h-4 w-4 text-amber" />
                              <span className="text-xs font-medium uppercase tracking-wider">Wake</span>
                            </div>
                            <span className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                              {formatTimeDisplay(schedule.prescribedWakeTime)}
                            </span>
                          </div>
                        </div>

                        <div className="text-center text-sm text-muted-foreground mb-4 font-medium">
                          {formatDuration(schedule.timeInBedMins)} in bed
                        </div>

                        {/* Adjustment info */}
                        {schedule.adjustmentMade && schedule.adjustmentMade !== "BASELINE" && (
                          <div className="flex items-center justify-center gap-2 text-sm mb-3">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {getAdjustmentDescription(schedule.adjustmentMade, schedule.adjustmentMins)}
                            </span>
                          </div>
                        )}

                        {/* Feedback message */}
                        {schedule.feedbackMessage && (
                          <div className="p-4 bg-card/60 backdrop-blur-sm rounded-xl border border-primary/10">
                            <p className="text-sm leading-relaxed">{schedule.feedbackMessage}</p>
                          </div>
                        )}

                        {/* Weekly efficiency and adherence */}
                        {(schedule.avgSleepEfficiency !== null || schedule.adherencePercentage !== null) && (
                          <div className="mt-4 flex flex-wrap justify-center gap-5 sm:gap-8">
                            {schedule.avgSleepEfficiency !== null && (
                              <div className="flex items-center gap-2 text-sm">
                                <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center">
                                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Efficiency</p>
                                  <p className="font-semibold">{schedule.avgSleepEfficiency.toFixed(0)}%</p>
                                </div>
                              </div>
                            )}
                            {schedule.adherencePercentage !== null && (
                              <div className="flex items-center gap-2 text-sm">
                                <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center">
                                  <Target className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Adherence</p>
                                  <p className="font-semibold">{schedule.adherencePercentage}%</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                )}

                {/* This Week / AI Coach Card */}
                {programme ? (
                  <Card className="sa-card sa-animate-in sa-stagger-2 overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-[15px] font-semibold truncate">
                            Week {programme.progress.currentWeek} of {programme.totalWeeks}: {programme.topic}
                          </CardTitle>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full mt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${(programme.progress.currentWeek / programme.totalWeeks) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {programme.progress.currentWeek} of {programme.totalWeeks} weeks completed
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Daily nudge */}
                      <div className="rounded-xl sa-gradient-dusk border border-primary/8 p-4">
                        <p className="text-sm leading-relaxed">{programme.dailyNudge.message}</p>
                      </div>

                      {/* This week's actions */}
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <h4 className="text-sm font-semibold">This week's actions</h4>
                          <span className="text-xs text-muted-foreground font-medium tabular-nums">
                            {completedActions.size}/{programme.dailyActions.length}
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {programme.dailyActions.map((action) => {
                            const done = completedActions.has(action.id);
                            return (
                              <li key={action.id}>
                                <button
                                  type="button"
                                  onClick={() => toggleAction(action.id)}
                                  className={`flex items-start gap-2.5 w-full text-left p-2.5 rounded-xl transition-all duration-200 ${
                                    done ? "bg-primary/4" : "hover:bg-muted/50"
                                  }`}
                                >
                                  {done ? (
                                    <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0 mt-px" />
                                  ) : (
                                    <Circle className="h-[18px] w-[18px] text-muted-foreground/40 shrink-0 mt-px" />
                                  )}
                                  <span
                                    className={`text-sm leading-relaxed transition-colors ${
                                      done
                                        ? "line-through text-muted-foreground/50"
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
                    </CardContent>
                  </Card>
                ) : (
                  hasSchedule && (
                    <Card className="sa-card sa-animate-in sa-stagger-2 overflow-hidden border-primary/10">
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-start gap-4">
                          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 sa-animate-float">
                            <Sparkles className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1.5">Your AI Sleep Coach</h3>
                            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                              Ask questions and get personalised advice based on your real sleep
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
                      </CardContent>
                    </Card>
                  )
                )}

                {/* Sleep History (baseline and post-baseline) */}
                <div className="sa-animate-in sa-stagger-3">
                  <SleepHistory />
                </div>

                {/* Efficiency Chart (post-baseline) */}
                {hasSchedule && (
                  <div className="sa-animate-in sa-stagger-4">
                    <EfficiencyChart />
                  </div>
                )}

                {/* WHOOP Recovery Card */}
                {hasSchedule && (
                  <div className="sa-animate-in sa-stagger-5">
                    <RecoveryCard />
                  </div>
                )}

                {/* Coming Soon cards — show during baseline */}
                {!hasSchedule && (
                  <div className="space-y-4">
                    <Card className="sa-card sa-animate-in sa-stagger-3 opacity-60">
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <CalendarClock className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h3 className="font-semibold text-muted-foreground">Sleep Schedule</h3>
                              <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Once we have enough data, you'll receive a personalised sleep
                              window designed using CBT-i sleep restriction principles.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="sa-card sa-animate-in sa-stagger-4 opacity-60">
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <BarChart3 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h3 className="font-semibold text-muted-foreground">Sleep Trends</h3>
                              <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Track your sleep efficiency over time and see your patterns
                              improve week by week.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* WHOOP Recovery during baseline — show if connected */}
                    <div className="sa-animate-in sa-stagger-5">
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
