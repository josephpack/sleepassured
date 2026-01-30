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
  Lightbulb,
  Plus,
  ChevronRight,
  Loader2,
  Clock,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCurrentSchedule,
  initializeSchedule,
  CurrentScheduleResponse,
} from "@/features/diary/api";
import { getDailyTip, SleepTip } from "@/data/sleepTips";

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
  const { user, logout } = useAuth();
  const [scheduleData, setScheduleData] = useState<CurrentScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [dailyTip, setDailyTip] = useState<SleepTip | null>(null);

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

    // Get daily tip
    setDailyTip(getDailyTip());
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

  // Check if user has low sleep efficiency (below 80%)
  const hasLowEfficiency =
    schedule?.avgSleepEfficiency !== null &&
    schedule?.avgSleepEfficiency !== undefined &&
    schedule.avgSleepEfficiency < 80;

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">SleepAssured</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" asChild>
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Welcome Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Welcome back, {user?.name?.split(" ")[0]}!</CardTitle>
            <CardDescription>
              {user?.onboardingCompleted
                ? "Track your sleep and build better habits"
                : "Complete onboarding to start your sleep improvement journey"}
            </CardDescription>
          </CardHeader>
          {!user?.onboardingCompleted && (
            <CardContent>
              <Button asChild>
                <Link to="/onboarding">
                  Complete Onboarding
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>

        {user?.onboardingCompleted && (
          <>
            {/* Chat with Coach CTA - Above the fold */}
            <Card className="mb-6 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
              <Link to="/chat" className="block">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Chat with your Sleep Coach</CardTitle>
                        <CardDescription>
                          Get personalised advice based on your sleep data
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Link>
            </Card>

            {/* Low Efficiency Nudge */}
            {!isLoading && hasLowEfficiency && (
              <Card className="mb-6 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
                <Link to="/chat" className="block">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-amber-900 dark:text-amber-100">
                        Your sleep efficiency was {schedule?.avgSleepEfficiency?.toFixed(0)}%
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Tap to chat with your coach for tips to improve
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  </CardContent>
                </Link>
              </Card>
            )}

            {/* Loading State */}
            {isLoading && (
              <Card className="mb-6">
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            )}

            {/* Sleep Window Display (if baseline complete) */}
            {!isLoading && scheduleData?.hasSchedule && schedule && (
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
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                        <Moon className="h-4 w-4" />
                        <span className="text-sm">Bedtime</span>
                      </div>
                      <span className="text-2xl font-bold">
                        {formatTimeDisplay(schedule.prescribedBedtime)}
                      </span>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                        <Sun className="h-4 w-4" />
                        <span className="text-sm">Wake Time</span>
                      </div>
                      <span className="text-2xl font-bold">
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

                  {/* Weekly efficiency */}
                  {schedule.avgSleepEfficiency !== null && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                      Last week's sleep efficiency:{" "}
                      <span className="font-medium">
                        {schedule.avgSleepEfficiency.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Baseline Progress (if in baseline week) */}
            {!isLoading && !scheduleData?.hasSchedule && baselineStatus && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Building Your Baseline
                  </CardTitle>
                  <CardDescription>
                    We need a week of data to create your personalised schedule
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {baselineStatus.entriesLogged} of 5 nights logged
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (baselineStatus.entriesLogged / 5) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    {baselineStatus.message}
                  </p>

                  {/* Initialize button when baseline is complete */}
                  {baselineStatus.isComplete && (
                    <Button onClick={handleInitializeSchedule} disabled={isInitializing}>
                      {isInitializing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Get My Sleep Schedule
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card className="hover:bg-muted/50 transition-colors">
                <Link to="/diary" className="block">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="h-5 w-5 text-primary" />
                      Log Sleep
                    </CardTitle>
                    <CardDescription>
                      Record last night's sleep in your diary
                    </CardDescription>
                  </CardHeader>
                </Link>
              </Card>

              <Card className="hover:bg-muted/50 transition-colors">
                <Link to="/diary" className="block">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Moon className="h-5 w-5 text-primary" />
                      View Diary
                    </CardTitle>
                    <CardDescription>
                      See your recent sleep entries and trends
                    </CardDescription>
                  </CardHeader>
                </Link>
              </Card>
            </div>

            {/* Daily Tip */}
            {dailyTip && (
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    Today's Sleep Tip
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <h4 className="font-medium mb-2">{dailyTip.title}</h4>
                  <p className="text-sm text-muted-foreground">{dailyTip.content}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
