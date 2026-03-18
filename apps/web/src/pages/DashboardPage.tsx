import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Moon,
  Sun,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Loader2,
  Sparkles,
  Lock,
  BarChart3,
  CalendarClock,
  AlertTriangle,
  Wifi,
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
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, "0")}`;
}

function formatTimePeriod(timeStr: string): string {
  const parts = timeStr.split(":").map(Number);
  const hours = parts[0] ?? 0;
  return hours >= 12 ? "PM" : "AM";
}

// Calculate hours and minutes from total minutes
function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (minutes === 0) return `${hours}h`;
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

function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 21 || hour < 8;
}

// ═══════════════════════════════════════
// SVG ILLUSTRATIONS
// ═══════════════════════════════════════
function DayIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" className="mx-auto">
      {/* Horizon line */}
      <ellipse cx="60" cy="65" rx="55" ry="3" fill="hsla(33,20%,50%,0.08)" />
      {/* Sun */}
      <circle cx="60" cy="38" r="16" fill="hsla(30,50%,60%,0.15)" />
      <circle cx="60" cy="38" r="11" fill="hsla(25,45%,58%,0.25)" />
      <circle cx="60" cy="38" r="7" fill="hsla(20,50%,62%,0.5)" />
      {/* Rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 60 + 20 * Math.cos(rad);
        const y1 = 38 + 20 * Math.sin(rad);
        const x2 = 60 + 26 * Math.cos(rad);
        const y2 = 38 + 26 * Math.sin(rad);
        return (
          <line
            key={angle}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="hsla(25,45%,60%,0.2)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function NightIllustration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" className="mx-auto">
      {/* Moon */}
      <circle cx="55" cy="35" r="14" fill="hsla(33,25%,75%,0.15)" />
      <circle cx="55" cy="35" r="10" fill="hsla(33,20%,70%,0.2)" />
      {/* Moon crescent cutout */}
      <circle cx="61" cy="30" r="9" fill="hsla(30,8%,7%,0.8)" />
      {/* Stars */}
      <circle cx="85" cy="20" r="1.5" fill="hsla(33,25%,75%,0.3)" />
      <circle cx="30" cy="25" r="1" fill="hsla(33,25%,75%,0.2)" />
      <circle cx="95" cy="40" r="1" fill="hsla(33,25%,75%,0.2)" />
      <circle cx="75" cy="50" r="1.2" fill="hsla(33,25%,75%,0.25)" />
      <circle cx="40" cy="55" r="0.8" fill="hsla(33,25%,75%,0.15)" />
      <circle cx="100" cy="28" r="0.8" fill="hsla(33,25%,75%,0.15)" />
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
  const [dataExpanded, setDataExpanded] = useState(() => {
    try {
      return localStorage.getItem("sa_data_expanded") === "true";
    } catch {
      return false;
    }
  });

  // Track dashboard views for intro text
  useEffect(() => {
    try {
      const views = parseInt(localStorage.getItem("sa_dashboard_views") ?? "0", 10);
      localStorage.setItem("sa_dashboard_views", String(views + 1));
    } catch {
      // Ignore
    }
  }, []);

  const dashboardViews = (() => {
    try {
      return parseInt(localStorage.getItem("sa_dashboard_views") ?? "0", 10);
    } catch {
      return 0;
    }
  })();

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

  const toggleDataExpanded = () => {
    setDataExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sa_data_expanded", String(next));
      } catch {
        // Ignore
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

  // Find first uncompleted action
  const nextAction = programme?.dailyActions.find((a) => !completedActions.has(a.id));
  const allActionsDone = programme ? programme.dailyActions.every((a) => completedActions.has(a.id)) : false;

  return (
    <div className="px-4 pt-6">
      <div className="mx-auto max-w-lg">
        {/* ═══════════════════════════════════════
            HEADER — greeting + phase pill
            ═══════════════════════════════════════ */}
        <div className="mb-4 animate-fade-up">
          <p className="text-sm text-muted-foreground font-medium">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </p>
          {hasSchedule && programme ? (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/25 bg-primary/8">
              <span className="text-xs font-medium text-primary">
                Week {programme.progress.currentWeek} of {programme.totalWeeks} · {programme.topic}
              </span>
            </div>
          ) : (
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground mt-0.5">
              Your Sleep
            </h1>
          )}
        </div>

        {/* ═══════════════════════════════════════
            SVG ILLUSTRATION
            ═══════════════════════════════════════ */}
        <div className="mb-4 animate-fade-up stagger-1">
          {isNightTime() ? <NightIllustration /> : <DayIllustration />}
        </div>

        {/* WHOOP reconnect banner */}
        {needsReauth && (
          <div className="mb-5 animate-fade-up stagger-1 surface-card rounded-2xl p-4 border-l-2 border-l-primary">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">WHOOP needs refreshing</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sleep data syncing is paused.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0 rounded-xl text-xs border-border/40">
                <Link to="/settings">Reconnect</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Onboarding CTA */}
        {!user?.onboardingCompleted && (
          <div className="mb-5 animate-fade-up stagger-1 rounded-2xl overflow-hidden surface-card p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
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
        )}

        {user?.onboardingCompleted && (
          <>
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground mt-4 font-medium">Loading your dashboard...</p>
              </div>
            )}

            {!isLoading && (
              <div className="space-y-5">
                {/* ═══════════════════════════════════════
                    PRE-SCHEDULE STATES
                    ═══════════════════════════════════════ */}
                {!hasSchedule && (
                  <div className="animate-fade-up stagger-1 rounded-2xl overflow-hidden surface-card p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 animate-float">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="font-display text-lg font-semibold mb-1.5 tracking-tight text-foreground">
                          Your Sleep Coach, Powered by Real Data
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          SleepAssured uses your WHOOP sleep data to build a personalised
                          programme based on the most effective treatment for insomnia that exists.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isFirstTime && (
                  <div className="animate-fade-up stagger-2 surface-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Wifi className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
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

                {isBaseline && (
                  <div className="animate-fade-up stagger-2 surface-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
                        Building Your Baseline
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Collecting your sleep data — 7 nights needed to build your personalised schedule.
                    </p>
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-foreground">
                          {baselineStatus.entriesLogged} of 7 nights
                        </span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-primary rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.min(100, (baselineStatus.entriesLogged / 7) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">{baselineStatus.message}</p>
                    {baselineStatus.isComplete && (
                      <Button onClick={handleInitializeSchedule} disabled={isInitializing} className="rounded-xl w-full">
                        {isInitializing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Get My Sleep Schedule
                      </Button>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    COACH CARD — primary, most prominent
                    ═══════════════════════════════════════ */}
                {hasSchedule && (
                  <Link to="/chat" className="block animate-fade-up stagger-2">
                    <div className="surface-card rounded-2xl p-5 border-l-2 border-l-primary transition-colors hover:bg-[hsl(var(--surface-elevated))]">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {programme?.dailyNudge?.message ? (
                            <p className="text-sm leading-relaxed text-foreground/80">
                              {programme.dailyNudge.message}
                            </p>
                          ) : (
                            <p className="text-sm leading-relaxed text-foreground/80">
                              Get personalised advice based on your real sleep data.
                            </p>
                          )}
                          <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-primary">
                            <MessageCircle className="h-3.5 w-3.5" />
                            Chat with your coach
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {/* ═══════════════════════════════════════
                    DAILY ACTION CARD — single action
                    ═══════════════════════════════════════ */}
                {hasSchedule && programme && (
                  <div className="animate-fade-up stagger-3 surface-card rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Today's action
                    </h3>
                    {dashboardViews <= 3 && (
                      <p className="text-xs text-muted-foreground/70 mb-3 leading-relaxed">
                        Each day, we'll give you one small thing to try. Small steps lead to big changes.
                      </p>
                    )}
                    {allActionsDone ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/8">
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground">All done for today — great work!</span>
                      </div>
                    ) : nextAction ? (
                      <button
                        type="button"
                        onClick={() => toggleAction(nextAction.id)}
                        className="flex items-start gap-3 w-full text-left p-3 rounded-xl hover:bg-muted/40 transition-colors"
                      >
                        <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0 mt-px" />
                        <span className="text-sm leading-relaxed text-foreground/80">
                          {nextAction.text}
                        </span>
                      </button>
                    ) : null}
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    SLEEP WINDOW CARD — simplified
                    ═══════════════════════════════════════ */}
                {hasSchedule && schedule && (
                  <div className="animate-fade-up stagger-3 surface-card rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                      Your sleep window
                    </h3>
                    <div className="flex items-center justify-between">
                      {/* Bedtime */}
                      <div className="text-center flex-1">
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1.5">
                          <Moon className="h-3.5 w-3.5 text-primary/60" />
                          <span className="text-[10px] font-medium uppercase tracking-wider">Bedtime</span>
                        </div>
                        <p className="font-display text-2xl font-bold text-foreground leading-none">
                          {formatTimeDisplay(schedule.prescribedBedtime)}
                        </p>
                        <p className="text-muted-foreground text-xs font-medium mt-1">
                          {formatTimePeriod(schedule.prescribedBedtime)}
                        </p>
                      </div>

                      {/* Duration */}
                      <div className="px-2">
                        <div className="h-16 w-16 rounded-full border border-border flex items-center justify-center">
                          <span className="font-display text-xs font-semibold text-foreground whitespace-nowrap">
                            {formatDuration(schedule.timeInBedMins)}
                          </span>
                        </div>
                      </div>

                      {/* Wake time */}
                      <div className="text-center flex-1">
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1.5">
                          <Sun className="h-3.5 w-3.5 text-primary/60" />
                          <span className="text-[10px] font-medium uppercase tracking-wider">Wake up</span>
                        </div>
                        <p className="font-display text-2xl font-bold text-foreground leading-none">
                          {formatTimeDisplay(schedule.prescribedWakeTime)}
                        </p>
                        <p className="text-muted-foreground text-xs font-medium mt-1">
                          {formatTimePeriod(schedule.prescribedWakeTime)}
                        </p>
                      </div>
                    </div>

                    {/* Adjustment info */}
                    {schedule.adjustmentMade && schedule.adjustmentMade !== "BASELINE" && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 pt-3 border-t border-border/40">
                        <TrendingUp className="h-3.5 w-3.5 text-primary/60" />
                        <span className="font-medium">
                          {getAdjustmentDescription(schedule.adjustmentMade, schedule.adjustmentMins)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    DATA TOGGLE — collapsed by default
                    ═══════════════════════════════════════ */}
                {hasSchedule && (
                  <div className="animate-fade-up stagger-4">
                    <button
                      type="button"
                      onClick={toggleDataExpanded}
                      className="flex items-center justify-between w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="font-medium">View sleep data</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          dataExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {dataExpanded && (
                      <div className="space-y-5 animate-fade-up">
                        <SleepHistory />
                        <EfficiencyChart />
                        <RecoveryCard />
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    COMING SOON — pre-schedule
                    ═══════════════════════════════════════ */}
                {!hasSchedule && (
                  <div className="space-y-4">
                    <div className="animate-fade-up stagger-3 surface-card rounded-2xl p-5 opacity-50">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <CalendarClock className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-muted-foreground text-sm">Sleep Schedule</h3>
                            <Lock className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Once we have enough data, you'll get a personalised sleep
                            window — a specific bedtime and wake time designed to rebuild
                            your sleep.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="animate-fade-up stagger-4 surface-card rounded-2xl p-5 opacity-50">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-muted-foreground text-sm">Sleep Trends</h3>
                            <Lock className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Track how much of your time in bed you're actually sleeping,
                            and see your patterns improve week by week.
                          </p>
                        </div>
                      </div>
                    </div>

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
