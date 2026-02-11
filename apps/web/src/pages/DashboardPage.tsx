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
  Plus,
  ChevronRight,
  Loader2,
  Clock,
  Target,
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

  return (
    <div className="px-4 pb-4">
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

            {/* First-time user CTA (no schedule, no baseline) */}
            {!isLoading && !scheduleData?.hasSchedule && !baselineStatus && (
              <Card className="mb-6">
                <CardContent className="flex flex-col items-center text-center py-10 px-6">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Plus className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Log your first night's sleep</h2>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                    Start by recording a few nights in your diary. We'll use this to build your personalised sleep schedule.
                  </p>
                  <Button asChild size="lg">
                    <Link to="/diary">
                      Open Sleep Diary
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
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

            {/* Efficiency Chart (only show if has schedule) */}
            {!isLoading && scheduleData?.hasSchedule && (
              <div className="mb-6">
                <EfficiencyChart />
              </div>
            )}

            {/* WHOOP Recovery Card (hidden if not connected) */}
            {!isLoading && scheduleData?.hasSchedule && (
              <div className="mb-6">
                <RecoveryCard />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
