import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Moon,
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
  Clock,
  User,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import {
  getCurrentSchedule,
  initializeSchedule,
  CurrentScheduleResponse,
} from "@/features/diary/api";
import { EfficiencyChart } from "@/components/dashboard/EfficiencyChart";
import { RecoveryCard } from "@/components/dashboard/RecoveryCard";
import { SleepHistory } from "@/components/dashboard/SleepHistory";
import { useProviderAutoSync } from "@/hooks/useProviderAutoSync";
import { getProviderStatus } from "@/features/providers/api";
import { getUnifiedSleepHistory, UnifiedSleepHistoryRecord } from "@/features/providers/api";
import { getLatestRecovery } from "@/features/whoop/api/whoop";
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

// Format minutes to Xh Ym
function formatSleepMins(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

// Get adjustment description
function getAdjustmentDescription(
  adjustment: string | null,
  mins: number
): string | null {
  if (!adjustment || adjustment === "BASELINE") return null;
  if (adjustment === "NONE") return "Maintaining current schedule";
  if (adjustment === "INCREASE") return `Increased by ${mins} minutes · based on your sleep data`;
  if (adjustment === "DECREASE") return `Decreased by ${mins} minutes · based on your sleep data`;
  return null;
}

// Time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Format date like "WEDNESDAY, 18 MARCH"
function getFormattedDate(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();
  const date = now.getDate();
  const month = now.toLocaleDateString("en-GB", { month: "long" }).toUpperCase();
  return `${day}, ${date} ${month}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { needsReauth } = useProviderAutoSync();
  const [scheduleData, setScheduleData] = useState<CurrentScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState<boolean | null>(null);
  const [programme, setProgramme] = useState<ProgrammeResponse | null>(null);
  const [lastNight, setLastNight] = useState<UnifiedSleepHistoryRecord | null>(null);
  const [lastNightProvider, setLastNightProvider] = useState<string | null>(null);
  const [lastNightHrv, setLastNightHrv] = useState<number | null>(null);
  const [dataExpanded, setDataExpanded] = useState(() => {
    try {
      return localStorage.getItem("sa_data_expanded") === "true";
    } catch {
      return false;
    }
  });

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
        const [schedData, providerStatus] = await Promise.all([
          getCurrentSchedule(),
          getProviderStatus(),
        ]);
        setScheduleData(schedData);
        const anyConnected = providerStatus.providers.some((p) => p.connected);
        setDeviceConnected(anyConnected);

        // Load last-night data from unified sleep history
        if (anyConnected) {
          try {
            const [historyRes, recoveryRes] = await Promise.all([
              getUnifiedSleepHistory(1),
              getLatestRecovery(),
            ]);
            if (historyRes.records.length > 0) {
              const rec = historyRes.records[0]!;
              setLastNight(rec);
              setLastNightProvider(rec.provider === "whoop" ? "WHOOP" : rec.provider === "apple_health" ? "Apple Health" : rec.provider);
            }
            if (recoveryRes.recovery?.hrvRmssd != null) {
              setLastNightHrv(Math.round(recoveryRes.recovery.hrvRmssd));
            }
          } catch (error) {
            console.error("Failed to load sleep data:", error);
          }
        }

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

  // Efficiency colour
  const effColour = lastNight
    ? lastNight.sleepEfficiency >= 85
      ? "text-[hsl(var(--sage))]"
      : lastNight.sleepEfficiency >= 70
        ? "text-[hsl(var(--gold))]"
        : "text-[hsl(16,52%,62%)]"
    : "";

  return (
    <div className="px-5 pt-14">
      <div className="mx-auto max-w-lg">
        {/* ═══════════════════════════════════════
            HEADER — logo bar + greeting
            ═══════════════════════════════════════ */}
        <div className="mb-1 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <Logo />
            <Link
              to="/settings"
              className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center"
            >
              <User className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
          <p className="text-[13px] text-muted-foreground tracking-wider mb-0.5">
            {getFormattedDate()}
          </p>
          <p className="text-[22px] font-medium text-foreground mb-4">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </p>
        </div>

        {/* Week badge — gold, no topic */}
        {hasSchedule && programme && (
          <div className="mb-6 animate-fade-up stagger-1">
            <div className="inline-flex items-center gap-2 bg-secondary border border-border/60 rounded-full px-3.5 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--gold))]" />
              <span className="text-[13px] text-[hsl(var(--gold))]">
                Week {programme.progress.currentWeek} of {programme.totalWeeks}
              </span>
            </div>
          </div>
        )}

        {/* WHOOP reconnect banner */}
        {needsReauth && (
          <div className="mb-3 animate-fade-up stagger-1 surface-card rounded-2xl p-4 border-l-2 border-l-primary">
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
              <div className="space-y-3">
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
                          SleepAssured uses your sleep data to build a personalised
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
                        {deviceConnected ? "Waiting for Sleep Data" : "Connect a Device to Get Started"}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {deviceConnected
                        ? "We're automatically collecting your sleep data. We need 7 nights to understand your patterns and build your personalised schedule."
                        : "Connect your WHOOP or Apple Health to start tracking sleep automatically. We need 7 nights of data to build your personalised schedule."}
                    </p>
                    {!deviceConnected && (
                      <Button asChild className="rounded-xl">
                        <Link to="/settings">
                          Connect a device
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
                    WHOOP DATA STRIP — last night
                    ═══════════════════════════════════════ */}
                {hasSchedule && lastNight && (
                  <div className="animate-fade-up stagger-1 surface-card rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-secondary border border-border/60 flex items-center justify-center">
                        <Moon className="h-3.5 w-3.5 text-[hsl(var(--gold))]" />
                      </div>
                      <span className="text-[12px] text-muted-foreground tracking-widest uppercase">Last night{lastNightProvider ? ` · ${lastNightProvider}` : ""}</span>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">Sleep</p>
                        <p className="text-[15px] font-medium text-foreground">{formatSleepMins(lastNight.totalSleepMins)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">Efficiency</p>
                        <p className={`text-[15px] font-medium ${effColour}`}>{Math.round(lastNight.sleepEfficiency)}%</p>
                      </div>
                      {lastNightHrv != null && (
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">HRV</p>
                          <p className="text-[15px] font-medium text-foreground">{lastNightHrv}ms</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    COACH CARD — hero card
                    ═══════════════════════════════════════ */}
                {hasSchedule && (
                  <div className="animate-fade-up stagger-2 surface-card rounded-2xl p-5">
                    <div className="flex items-center gap-2.5 mb-3.5">
                      <div className="h-9 w-9 rounded-full bg-[hsl(var(--gold))] flex items-center justify-center shrink-0">
                        <Sparkles className="h-[18px] w-[18px] text-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground">Your coach</p>
                        <p className="text-[11px] text-muted-foreground">Based on last night's data</p>
                      </div>
                      {lastNight && (
                        <div className="bg-secondary rounded-md px-2 py-1">
                          <span className="text-[11px] text-[hsl(var(--gold))]">Live</span>
                        </div>
                      )}
                    </div>

                    {programme?.dailyNudge?.message ? (
                      <p className="text-[15px] leading-relaxed text-foreground/75 mb-4">
                        {programme.dailyNudge.message}
                      </p>
                    ) : (
                      <p className="text-[15px] leading-relaxed text-foreground/75 mb-4">
                        Get personalised advice based on your real sleep data.
                      </p>
                    )}

                    <Button asChild className="w-full rounded-xl bg-[hsl(var(--gold))] text-background hover:bg-[hsl(36,55%,46%)] h-12 text-[15px] font-medium">
                      <Link to="/chat">
                        Talk to your coach
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    SLEEP WINDOW CARD
                    ═══════════════════════════════════════ */}
                {hasSchedule && schedule && (
                  <div className="animate-fade-up stagger-3 surface-card rounded-2xl px-5 py-4">
                    <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-4">
                      Your sleep window
                    </h3>
                    <div className="flex items-center justify-between">
                      {/* Bedtime */}
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Bedtime</p>
                        <p className="text-[30px] font-medium text-foreground leading-none">
                          {formatTimeDisplay(schedule.prescribedBedtime)}
                          <span className="text-sm text-muted-foreground font-normal ml-1">
                            {formatTimePeriod(schedule.prescribedBedtime)}
                          </span>
                        </p>
                      </div>

                      {/* Duration — rectangular pill */}
                      <div className="bg-secondary rounded-xl px-3.5 py-2 text-center">
                        <p className="text-[16px] font-medium text-foreground whitespace-nowrap">
                          {formatDuration(schedule.timeInBedMins)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">window</p>
                      </div>

                      {/* Wake time */}
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Wake up</p>
                        <p className="text-[30px] font-medium text-foreground leading-none">
                          {formatTimeDisplay(schedule.prescribedWakeTime)}
                          <span className="text-sm text-muted-foreground font-normal ml-1">
                            {formatTimePeriod(schedule.prescribedWakeTime)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Adjustment info */}
                    {schedule.adjustmentMade && schedule.adjustmentMade !== "BASELINE" && schedule.adjustmentMade !== "NONE" && (
                      <div className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--sage))] mt-3 pt-3 border-t border-border/30">
                        <Clock className="h-3 w-3" />
                        <span>
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
                      <div className="space-y-3 animate-fade-up">
                        <SleepHistory />
                        <EfficiencyChart />
                        <RecoveryCard />
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    TONIGHT'S TIP — data-driven one-liner
                    ═══════════════════════════════════════ */}
                {hasSchedule && programme?.dailyTip && (
                  <div className="animate-fade-up stagger-4 surface-card rounded-2xl px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-md bg-[hsl(var(--gold))]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Lightbulb className="h-3.5 w-3.5 text-[hsl(var(--gold))]" />
                      </div>
                      <div>
                        <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">
                          Tonight's tip
                        </h3>
                        <p className="text-[15px] leading-relaxed text-foreground/80">
                          {programme.dailyTip.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    COMING SOON — pre-schedule
                    ═══════════════════════════════════════ */}
                {!hasSchedule && (
                  <div className="space-y-3">
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
