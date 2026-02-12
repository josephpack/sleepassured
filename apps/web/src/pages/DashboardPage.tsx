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
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCurrentSchedule,
  initializeSchedule,
  CurrentScheduleResponse,
} from "@/features/diary/api";
import { EfficiencyChart } from "@/components/dashboard/EfficiencyChart";
import { RecoveryCard } from "@/components/dashboard/RecoveryCard";

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
  const [scheduleData, setScheduleData] = useState<CurrentScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getCurrentSchedule();
        setScheduleData(data);
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
    <div className="px-4 pb-8 pt-2">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">SleepAssured</h1>
            {schedule?.weekNumber && (
              <span className="rounded-full bg-primary/10 px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium text-primary whitespace-nowrap">
                Week {schedule.weekNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user?.name && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Hi, {user.name.split(" ")[0]}
              </span>
            )}
            <Button variant="outline" size="icon" asChild className="h-10 w-10">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Onboarding CTA for users who haven't completed onboarding */}
        {!user?.onboardingCompleted && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Welcome, {user?.name?.split(" ")[0]}!</CardTitle>
              <CardDescription>
                Complete onboarding to start your sleep improvement journey
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/onboarding">
                  Complete Onboarding
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {user?.onboardingCompleted && (
          <>
            {/* Loading State */}
            {isLoading && (
              <Card className="mb-6">
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            )}

            {!isLoading && (
              <>
                {/* Hero Card — show during baseline / first-time */}
                {!hasSchedule && (
                  <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold mb-1">
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
                  </Card>
                )}

                {/* First-time user — log first night */}
                {isFirstTime && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Get Started
                      </CardTitle>
                      <CardDescription>
                        We need 7 nights of sleep data to understand your patterns and
                        build your personalised schedule.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild size="lg">
                        <Link to="/diary">
                          Log Tonight's Sleep
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Baseline Progress */}
                {isBaseline && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Building Your Baseline
                      </CardTitle>
                      <CardDescription>
                        We need 7 nights of sleep data to understand your patterns and
                        build your personalised schedule.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {baselineStatus.entriesLogged} of 7 nights logged
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
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
                      {baselineStatus.isComplete ? (
                        <Button onClick={handleInitializeSchedule} disabled={isInitializing}>
                          {isInitializing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Get My Sleep Schedule
                        </Button>
                      ) : (
                        <Button asChild>
                          <Link to="/diary">
                            Log Tonight's Sleep
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Sleep Window Display (post-baseline) */}
                {hasSchedule && schedule && (
                  <Card className="mb-6 border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Your Sleep Window
                      </CardTitle>
                      <CardDescription>
                        Follow this schedule for better sleep
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-4">
                        <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                            <Moon className="h-4 w-4" />
                            <span className="text-sm">Bedtime</span>
                          </div>
                          <span className="text-xl sm:text-2xl font-bold">
                            {formatTimeDisplay(schedule.prescribedBedtime)}
                          </span>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                            <Sun className="h-4 w-4" />
                            <span className="text-sm">Wake Time</span>
                          </div>
                          <span className="text-xl sm:text-2xl font-bold">
                            {formatTimeDisplay(schedule.prescribedWakeTime)}
                          </span>
                        </div>
                      </div>

                      <div className="text-center text-sm text-muted-foreground mb-4">
                        Time in bed: {formatDuration(schedule.timeInBedMins)}
                      </div>

                      {/* Adjustment info */}
                      {schedule.adjustmentMade && schedule.adjustmentMade !== "BASELINE" && (
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span>
                            {getAdjustmentDescription(schedule.adjustmentMade, schedule.adjustmentMins)}
                          </span>
                        </div>
                      )}

                      {/* Feedback message */}
                      {schedule.feedbackMessage && (
                        <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                          <p className="text-sm">{schedule.feedbackMessage}</p>
                        </div>
                      )}

                      {/* Weekly efficiency and adherence */}
                      {(schedule.avgSleepEfficiency !== null || schedule.adherencePercentage !== null) && (
                        <div className="mt-4 flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
                          {schedule.avgSleepEfficiency !== null && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              <span>
                                Efficiency:{" "}
                                <span className="font-medium">
                                  {schedule.avgSleepEfficiency.toFixed(0)}%
                                </span>
                              </span>
                            </div>
                          )}
                          {schedule.adherencePercentage !== null && (
                            <div className="flex items-center gap-1">
                              <Target className="h-4 w-4" />
                              <span>
                                Adherence:{" "}
                                <span className="font-medium">
                                  {schedule.adherencePercentage}%
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* AI Coach Card — always visible */}
                <Card className="mb-6 border-primary/20">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">Your AI Sleep Coach</h3>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                          Ask questions and get personalised advice based on your real sleep
                          data and CBT-i principles.
                        </p>
                        <Button asChild>
                          <Link to="/chat">
                            Chat with Your Coach
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Post-baseline: Log sleep quick-link */}
                {hasSchedule && (
                  <div className="mb-6">
                    <Button asChild variant="outline" className="w-full" size="lg">
                      <Link to="/diary">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Log Tonight's Sleep
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Efficiency Chart (post-baseline) */}
                {hasSchedule && (
                  <div className="mb-6">
                    <EfficiencyChart />
                  </div>
                )}

                {/* WHOOP Recovery Card */}
                {hasSchedule && (
                  <div className="mb-6">
                    <RecoveryCard />
                  </div>
                )}

                {/* Coming Soon cards — show during baseline */}
                {!hasSchedule && (
                  <div className="space-y-4">
                    <Card className="mb-0 opacity-75">
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <CalendarClock className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-muted-foreground">Sleep Schedule</h3>
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Once we have enough data, you'll receive a personalised sleep
                              window designed using CBT-i sleep restriction principles.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="mb-0 opacity-75">
                      <CardContent className="pt-6 pb-6">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <BarChart3 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-muted-foreground">Sleep Trends</h3>
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
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
                    <div>
                      <RecoveryCard />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
