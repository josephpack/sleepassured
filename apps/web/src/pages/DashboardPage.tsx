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

// ═══════════════════════════════════════
// EFFICIENCY RING — used in hero card
// ═══════════════════════════════════════
function EfficiencyRing({ value, size = 72, label }: { value: number; size?: number; label?: string }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsla(0,0%,100%,0.15)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 1s ease-out" }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="white"
          className="font-display font-bold"
          style={{ fontSize: size > 70 ? "1.25rem" : "1rem" }}
        >
          {value.toFixed(0)}
        </text>
      </svg>
      {label && (
        <span className="text-[10px] text-white/70 font-medium mt-1">{label}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// CLOCK GAUGE — bedtime/wake with dial
// ═══════════════════════════════════════
function ClockGauge({ durationMins }: { durationMins: number }) {
  const size = 120;
  const center = size / 2;
  const outerR = 52;
  const innerR = 44;
  const tickCount = 60;
  const needleLength = 38;

  // Needle angle: duration as proportion of 12h, starting from 12 o'clock
  const proportion = Math.min(durationMins / (12 * 60), 1);
  const needleAngle = proportion * 360 - 90; // -90 to start at top
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleX = center + needleLength * Math.cos(needleRad);
  const needleY = center + needleLength * Math.sin(needleRad);

  // Sleep arc (from 12 o'clock clockwise by proportion)
  const arcStartAngle = -90;
  const arcEndAngle = arcStartAngle + proportion * 360;
  const arcStartRad = (arcStartAngle * Math.PI) / 180;
  const arcEndRad = (arcEndAngle * Math.PI) / 180;
  const arcR = (outerR + innerR) / 2;
  const largeArc = proportion > 0.5 ? 1 : 0;
  const arcX1 = center + arcR * Math.cos(arcStartRad);
  const arcY1 = center + arcR * Math.sin(arcStartRad);
  const arcX2 = center + arcR * Math.cos(arcEndRad);
  const arcY2 = center + arcR * Math.sin(arcEndRad);

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="shrink-0">
        {/* Outer glow ring */}
        <circle cx={center} cy={center} r={outerR + 2} fill="none" stroke="hsla(220,40%,100%,0.04)" strokeWidth={1} />

        {/* Background ring */}
        <circle cx={center} cy={center} r={arcR} fill="none" stroke="hsla(220,40%,100%,0.08)" strokeWidth={6} />

        {/* Sleep duration arc */}
        <path
          d={`M ${arcX1} ${arcY1} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcX2} ${arcY2}`}
          fill="none"
          stroke="hsla(225,85%,60%,0.5)"
          strokeWidth={6}
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {Array.from({ length: tickCount }).map((_, i) => {
          const angle = (i / tickCount) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const isMajor = i % 5 === 0;
          const r1 = isMajor ? outerR - 2 : outerR - 1;
          const r2 = outerR + (isMajor ? 3 : 1.5);
          return (
            <line
              key={i}
              x1={center + r1 * Math.cos(rad)}
              y1={center + r1 * Math.sin(rad)}
              x2={center + r2 * Math.cos(rad)}
              y2={center + r2 * Math.sin(rad)}
              stroke={isMajor ? "hsla(220,40%,100%,0.25)" : "hsla(220,40%,100%,0.1)"}
              strokeWidth={isMajor ? 1.5 : 0.75}
            />
          );
        })}

        {/* Inner circle */}
        <circle cx={center} cy={center} r={innerR - 8} fill="hsla(222,47%,5%,0.6)" stroke="hsla(220,40%,100%,0.08)" strokeWidth={1} />

        {/* Needle */}
        <line
          x1={center}
          y1={center}
          x2={needleX}
          y2={needleY}
          stroke="hsl(38 80% 55%)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Needle center dot */}
        <circle cx={center} cy={center} r={3} fill="hsl(38 80% 55%)" />
        <circle cx={center} cy={center} r={1.5} fill="hsl(222 47% 6%)" />

        {/* Duration text */}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="white"
          className="font-display font-semibold"
          style={{ fontSize: "0.85rem" }}
        >
          {formatDuration(durationMins)}
        </text>
        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="hsla(220,15%,65%,1)"
          style={{ fontSize: "0.55rem" }}
        >
          in bed
        </text>
      </svg>
    </div>
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
        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <p className="text-sm text-white/60 font-medium">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white mt-0.5">
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
                <p className="text-sm font-semibold text-white">WHOOP needs refreshing</p>
                <p className="text-xs text-white/50 mt-0.5">
                  Sleep data syncing is paused.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0 rounded-xl text-xs border-white/15">
                <Link to="/settings">Reconnect</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Onboarding CTA */}
        {!user?.onboardingCompleted && (
          <div className="mb-5 animate-fade-up stagger-1 rounded-2xl overflow-hidden gradient-hero p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight text-white">
              Welcome, {firstName}
            </h2>
            <p className="text-sm text-white/70 mt-1 mb-4">
              Complete onboarding to start your sleep improvement journey
            </p>
            <Button asChild className="rounded-xl bg-white text-primary hover:bg-white/90">
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
                <p className="text-sm text-white/50 mt-4 font-medium">Loading your dashboard...</p>
              </div>
            )}

            {!isLoading && (
              <div className="space-y-5">
                {/* ═══════════════════════════════════════
                    PRE-SCHEDULE STATES
                    ═══════════════════════════════════════ */}
                {!hasSchedule && (
                  <div className="animate-fade-up stagger-1 rounded-2xl overflow-hidden gradient-hero p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 animate-float">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h2 className="font-display text-lg font-semibold mb-1.5 tracking-tight text-white">
                          AI Sleep Coach, Powered by Real Data
                        </h2>
                        <p className="text-sm text-white/70 leading-relaxed">
                          SleepAssured combines your WHOOP sleep data with AI trained on CBT-i
                          principles to create a personalised programme.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isFirstTime && (
                  <div className="animate-fade-up stagger-2 glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <Wifi className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display text-base font-semibold tracking-tight text-white">
                        {whoopConnected ? "Waiting for Sleep Data" : "Connect WHOOP to Get Started"}
                      </h3>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed mb-4">
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
                  <div className="animate-fade-up stagger-2 glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display text-base font-semibold tracking-tight text-white">
                        Building Your Baseline
                      </h3>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed mb-4">
                      Collecting your sleep data — 7 nights needed to build your personalised schedule.
                    </p>
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-white/50">Progress</span>
                        <span className="font-semibold text-white">
                          {baselineStatus.entriesLogged} of 7 nights
                        </span>
                      </div>
                      <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-primary rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.min(100, (baselineStatus.entriesLogged / 7) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-white/50 mb-4">{baselineStatus.message}</p>
                    {baselineStatus.isComplete && (
                      <Button onClick={handleInitializeSchedule} disabled={isInitializing} className="rounded-xl w-full">
                        {isInitializing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Get My Sleep Schedule
                      </Button>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    HERO CARD — Blue gradient with metrics
                    ═══════════════════════════════════════ */}
                {hasSchedule && schedule && (
                  <div className="animate-fade-up stagger-1 rounded-2xl overflow-hidden" style={{
                    background: "linear-gradient(145deg, hsl(225 80% 50%) 0%, hsl(240 70% 48%) 50%, hsl(250 65% 42%) 100%)",
                  }}>
                    <div className="p-5">
                      {/* Top row: Efficiency ring + metrics */}
                      <div className="flex items-center gap-4 mb-4">
                        <EfficiencyRing
                          value={schedule.avgSleepEfficiency ?? 0}
                          size={72}
                          label="Efficiency"
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex gap-3">
                            <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5">
                              <p className="text-white font-display font-semibold text-lg leading-tight">
                                {formatDuration(schedule.timeInBedMins)}
                              </p>
                              <p className="text-white/60 text-[10px] font-medium mt-0.5">Time in Bed</p>
                            </div>
                            <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5">
                              <p className="text-white font-display font-semibold text-lg leading-tight">
                                {schedule.adherencePercentage !== null ? `${schedule.adherencePercentage}%` : "—"}
                              </p>
                              <p className="text-white/60 text-[10px] font-medium mt-0.5">Adherence</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Adjustment info */}
                      {schedule.adjustmentMade && schedule.adjustmentMade !== "BASELINE" && (
                        <div className="flex items-center gap-2 text-xs text-white/80 mb-3">
                          <TrendingUp className="h-3 w-3" />
                          <span className="font-medium">
                            {getAdjustmentDescription(schedule.adjustmentMade, schedule.adjustmentMins)}
                          </span>
                        </div>
                      )}

                      {/* Feedback message */}
                      {schedule.feedbackMessage && (
                        <div className="p-3 bg-white/8 rounded-xl">
                          <p className="text-xs leading-relaxed text-white/70">{schedule.feedbackMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    SLEEP WINDOW — Clock gauge section
                    ═══════════════════════════════════════ */}
                {hasSchedule && schedule && (
                  <div className="animate-fade-up stagger-2 glass-card rounded-2xl p-5">
                    <h3 className="font-display text-base font-semibold tracking-tight text-white mb-4">Your Sleep Window</h3>
                    <div className="flex items-center justify-between">
                      {/* Bedtime */}
                      <div className="text-center flex-1">
                        <div className="glass-card rounded-xl p-3 inline-block">
                          <p className="font-display text-2xl font-bold text-white leading-none">
                            {formatTimeDisplay(schedule.prescribedBedtime)}
                          </p>
                          <p className="text-white/50 text-xs font-medium mt-1">
                            {formatTimePeriod(schedule.prescribedBedtime)}
                          </p>
                        </div>
                        <p className="text-white/40 text-[11px] font-medium mt-2 flex items-center justify-center gap-1">
                          <Moon className="h-3 w-3" />
                          Bedtime
                        </p>
                      </div>

                      {/* Clock gauge */}
                      <ClockGauge durationMins={schedule.timeInBedMins} />

                      {/* Wake time */}
                      <div className="text-center flex-1">
                        <div className="glass-card rounded-xl p-3 inline-block">
                          <p className="font-display text-2xl font-bold text-white leading-none">
                            {formatTimeDisplay(schedule.prescribedWakeTime)}
                          </p>
                          <p className="text-white/50 text-xs font-medium mt-1">
                            {formatTimePeriod(schedule.prescribedWakeTime)}
                          </p>
                        </div>
                        <p className="text-white/40 text-[11px] font-medium mt-2 flex items-center justify-center gap-1">
                          <Sun className="h-3 w-3" />
                          Wake Up
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════
                    PROGRAMME / COACH CARD
                    ═══════════════════════════════════════ */}
                {programme ? (
                  <div className="animate-fade-up stagger-3 glass-card rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          Week {programme.progress.currentWeek} of {programme.totalWeeks}: {programme.topic}
                        </h3>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-primary rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${(programme.progress.currentWeek / programme.totalWeeks) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-white/40 mt-1.5">
                        {programme.progress.currentWeek} of {programme.totalWeeks} weeks completed
                      </p>
                    </div>

                    <div className="rounded-xl bg-primary/8 border border-primary/15 p-3.5 mb-4">
                      <p className="text-sm leading-relaxed text-white/80">{programme.dailyNudge.message}</p>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">This week's actions</h4>
                        <span className="text-xs text-white/40 font-medium tabular-nums">
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
                                  done ? "bg-primary/8" : "hover:bg-white/5"
                                }`}
                              >
                                {done ? (
                                  <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0 mt-px" />
                                ) : (
                                  <Circle className="h-[18px] w-[18px] text-white/20 shrink-0 mt-px" />
                                )}
                                <span
                                  className={`text-sm leading-relaxed transition-colors ${
                                    done
                                      ? "line-through text-white/30"
                                      : "text-white/70"
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

                    <Button asChild className="w-full rounded-xl h-11">
                      <Link to="/chat">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Talk to Your Coach
                      </Link>
                    </Button>
                  </div>
                ) : (
                  hasSchedule && (
                    <div className="animate-fade-up stagger-3 glass-card rounded-2xl p-5">
                      <div className="flex items-start gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 animate-float">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1.5 text-white">Your AI Sleep Coach</h3>
                          <p className="text-sm text-white/60 mb-4 leading-relaxed">
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
                <div className="animate-fade-up stagger-4">
                  <SleepHistory />
                </div>

                {/* Efficiency Chart */}
                {hasSchedule && (
                  <div className="animate-fade-up stagger-5">
                    <EfficiencyChart />
                  </div>
                )}

                {/* WHOOP Recovery */}
                {hasSchedule && (
                  <div className="animate-fade-up stagger-6">
                    <RecoveryCard />
                  </div>
                )}

                {/* Coming Soon — baseline */}
                {!hasSchedule && (
                  <div className="space-y-4">
                    <div className="animate-fade-up stagger-3 glass-card rounded-2xl p-5 opacity-50">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                          <CalendarClock className="h-5 w-5 text-white/40" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-white/50 text-sm">Sleep Schedule</h3>
                            <Lock className="h-3 w-3 text-white/30" />
                          </div>
                          <p className="text-sm text-white/40 leading-relaxed">
                            Once we have enough data, you'll receive a personalised sleep
                            window designed using CBT-i sleep restriction principles.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="animate-fade-up stagger-4 glass-card rounded-2xl p-5 opacity-50">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                          <BarChart3 className="h-5 w-5 text-white/40" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-white/50 text-sm">Sleep Trends</h3>
                            <Lock className="h-3 w-3 text-white/30" />
                          </div>
                          <p className="text-sm text-white/40 leading-relaxed">
                            Track your sleep efficiency over time and see your patterns
                            improve week by week.
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
