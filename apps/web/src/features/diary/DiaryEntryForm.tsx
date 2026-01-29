import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw } from "lucide-react";
import {
  createDiaryEntry,
  updateDiaryEntry,
  getPrefillData,
  DiaryEntry,
  DiaryEntryInput,
} from "./api";
import { getWhoopStatus } from "@/features/whoop/api/whoop";

const diaryFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  bedtime: z.string().min(1, "Bedtime is required"),
  sleepOnsetLatencyMins: z.number().min(0, "Must be 0 or greater").max(600),
  numberOfAwakenings: z.number().min(0, "Must be 0 or greater").max(50),
  wakeAfterSleepOnsetMins: z.number().min(0, "Must be 0 or greater").max(600),
  finalWakeTime: z.string().min(1, "Final wake time is required"),
  outOfBedTime: z.string().min(1, "Out of bed time is required"),
  subjectiveQuality: z.number().min(1).max(10),
  notes: z.string().optional(),
});

type DiaryFormData = z.infer<typeof diaryFormSchema>;

interface DiaryEntryFormProps {
  existingEntry?: DiaryEntry;
  selectedDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Get dates available for backfill (last 7 days)
function getAvailableDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]!);
  }
  return dates;
}

// Format date for display
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

export function DiaryEntryForm({
  existingEntry,
  selectedDate,
  onSuccess,
  onCancel,
}: DiaryEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [hasWhoop, setHasWhoop] = useState(false);
  const [whoopRecordId, setWhoopRecordId] = useState<string | undefined>();

  const isEditing = !!existingEntry;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DiaryFormData>({
    resolver: zodResolver(diaryFormSchema),
    defaultValues: {
      date: selectedDate || existingEntry?.date?.split("T")[0] || new Date().toISOString().split("T")[0],
      bedtime: existingEntry?.bedtime ? new Date(existingEntry.bedtime).toTimeString().slice(0, 5) : "23:00",
      sleepOnsetLatencyMins: existingEntry?.sleepOnsetLatencyMins ?? 15,
      numberOfAwakenings: existingEntry?.numberOfAwakenings ?? 0,
      wakeAfterSleepOnsetMins: existingEntry?.wakeAfterSleepOnsetMins ?? 0,
      finalWakeTime: existingEntry?.finalWakeTime ? new Date(existingEntry.finalWakeTime).toTimeString().slice(0, 5) : "06:30",
      outOfBedTime: existingEntry?.outOfBedTime ? new Date(existingEntry.outOfBedTime).toTimeString().slice(0, 5) : "07:00",
      subjectiveQuality: existingEntry?.subjectiveQuality ?? 5,
      notes: existingEntry?.notes ?? "",
    },
  });

  const currentDate = watch("date");
  const currentQuality = watch("subjectiveQuality");

  // Check WHOOP connection
  useEffect(() => {
    async function checkWhoop() {
      try {
        const status = await getWhoopStatus();
        setHasWhoop(status.connected);
      } catch {
        setHasWhoop(false);
      }
    }
    checkWhoop();
  }, []);

  // Handle WHOOP prefill
  const handlePrefill = async () => {
    if (!currentDate) return;

    setIsPrefilling(true);
    try {
      const { prefillData, message } = await getPrefillData(currentDate);

      if (!prefillData) {
        toast.info(message || "No WHOOP data available for this date");
        return;
      }

      // Parse times from ISO strings
      const bedtime = new Date(prefillData.bedtime);
      const finalWake = new Date(prefillData.finalWakeTime);
      const outOfBed = new Date(prefillData.outOfBedTime);

      setValue("bedtime", bedtime.toTimeString().slice(0, 5));
      setValue("sleepOnsetLatencyMins", prefillData.sleepOnsetLatencyMins);
      setValue("numberOfAwakenings", prefillData.numberOfAwakenings);
      setValue("wakeAfterSleepOnsetMins", prefillData.wakeAfterSleepOnsetMins);
      setValue("finalWakeTime", finalWake.toTimeString().slice(0, 5));
      setValue("outOfBedTime", outOfBed.toTimeString().slice(0, 5));
      setWhoopRecordId(prefillData.whoopSleepRecordId);

      toast.success("WHOOP data loaded. Please review and adjust if needed.");
    } catch (error) {
      console.error("Prefill error:", error);
      toast.error("Failed to load WHOOP data");
    } finally {
      setIsPrefilling(false);
    }
  };

  // Create datetime from date and time inputs
  const createDateTime = (dateStr: string, timeStr: string, isNextDay = false): string => {
    const parts = timeStr.split(":").map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
    if (isNextDay) {
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString();
  };

  const onSubmit = async (data: DiaryFormData) => {
    setIsSubmitting(true);
    try {
      // Determine if wake times are the next day (after midnight crossing)
      const bedHour = parseInt(data.bedtime.split(":")[0] ?? "0");
      const wakeHour = parseInt(data.finalWakeTime.split(":")[0] ?? "0");
      const outHour = parseInt(data.outOfBedTime.split(":")[0] ?? "0");

      // If bedtime is in the evening (18-23) and wake is in the morning (0-12), it's next day
      const bedtimeIsEvening = bedHour >= 18 || bedHour < 4;
      const wakeIsNextDay = bedtimeIsEvening && wakeHour >= 0 && wakeHour < 18;
      const outIsNextDay = bedtimeIsEvening && outHour >= 0 && outHour < 18;

      const entry: DiaryEntryInput = {
        date: data.date,
        bedtime: createDateTime(data.date, data.bedtime),
        sleepOnsetLatencyMins: data.sleepOnsetLatencyMins,
        numberOfAwakenings: data.numberOfAwakenings,
        wakeAfterSleepOnsetMins: data.wakeAfterSleepOnsetMins,
        finalWakeTime: createDateTime(data.date, data.finalWakeTime, wakeIsNextDay),
        outOfBedTime: createDateTime(data.date, data.outOfBedTime, outIsNextDay),
        subjectiveQuality: data.subjectiveQuality,
        source: whoopRecordId ? "hybrid" : "manual",
        whoopSleepRecordId: whoopRecordId,
        notes: data.notes,
      };

      if (isEditing) {
        await updateDiaryEntry(data.date, entry);
        toast.success("Diary entry updated");
      } else {
        await createDiaryEntry(entry);
        toast.success("Diary entry saved");
      }

      onSuccess?.();
    } catch (error: unknown) {
      console.error("Submit error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save entry";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit" : "Log"} Sleep Diary</CardTitle>
        <CardDescription>
          Record your sleep for {formatDateLabel(currentDate)}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <select
              {...register("date")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isEditing}
            >
              {getAvailableDates().map((date) => (
                <option key={date} value={date}>
                  {formatDateLabel(date)}
                </option>
              ))}
            </select>
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date.message}</p>
            )}
          </div>

          {/* WHOOP Prefill */}
          {hasWhoop && !isEditing && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">WHOOP Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Pre-fill with your WHOOP sleep data
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrefill}
                  disabled={isPrefilling}
                >
                  {isPrefilling ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Load WHOOP Data
                </Button>
              </div>
            </div>
          )}

          {/* Bedtime */}
          <div className="space-y-2">
            <Label htmlFor="bedtime">What time did you get into bed?</Label>
            <Input
              id="bedtime"
              type="time"
              {...register("bedtime")}
              className="max-w-[150px]"
            />
            {errors.bedtime && (
              <p className="text-sm text-destructive">{errors.bedtime.message}</p>
            )}
          </div>

          {/* Sleep Onset Latency */}
          <div className="space-y-2">
            <Label htmlFor="sleepOnsetLatencyMins">
              How long did it take you to fall asleep? (minutes)
            </Label>
            <Input
              id="sleepOnsetLatencyMins"
              type="number"
              min={0}
              max={600}
              {...register("sleepOnsetLatencyMins", { valueAsNumber: true })}
              className="max-w-[120px]"
            />
            {errors.sleepOnsetLatencyMins && (
              <p className="text-sm text-destructive">
                {errors.sleepOnsetLatencyMins.message}
              </p>
            )}
          </div>

          {/* Number of Awakenings */}
          <div className="space-y-2">
            <Label htmlFor="numberOfAwakenings">
              How many times did you wake up during the night?
            </Label>
            <Input
              id="numberOfAwakenings"
              type="number"
              min={0}
              max={50}
              {...register("numberOfAwakenings", { valueAsNumber: true })}
              className="max-w-[120px]"
            />
            {errors.numberOfAwakenings && (
              <p className="text-sm text-destructive">
                {errors.numberOfAwakenings.message}
              </p>
            )}
          </div>

          {/* WASO */}
          <div className="space-y-2">
            <Label htmlFor="wakeAfterSleepOnsetMins">
              Total time awake during the night? (minutes)
            </Label>
            <Input
              id="wakeAfterSleepOnsetMins"
              type="number"
              min={0}
              max={600}
              {...register("wakeAfterSleepOnsetMins", { valueAsNumber: true })}
              className="max-w-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Estimate the total time you spent awake after first falling asleep
            </p>
            {errors.wakeAfterSleepOnsetMins && (
              <p className="text-sm text-destructive">
                {errors.wakeAfterSleepOnsetMins.message}
              </p>
            )}
          </div>

          {/* Final Wake Time */}
          <div className="space-y-2">
            <Label htmlFor="finalWakeTime">
              What time did you finally wake up?
            </Label>
            <Input
              id="finalWakeTime"
              type="time"
              {...register("finalWakeTime")}
              className="max-w-[150px]"
            />
            {errors.finalWakeTime && (
              <p className="text-sm text-destructive">
                {errors.finalWakeTime.message}
              </p>
            )}
          </div>

          {/* Out of Bed Time */}
          <div className="space-y-2">
            <Label htmlFor="outOfBedTime">What time did you get out of bed?</Label>
            <Input
              id="outOfBedTime"
              type="time"
              {...register("outOfBedTime")}
              className="max-w-[150px]"
            />
            {errors.outOfBedTime && (
              <p className="text-sm text-destructive">
                {errors.outOfBedTime.message}
              </p>
            )}
          </div>

          {/* Subjective Quality */}
          <div className="space-y-3">
            <Label>Rate your sleep quality (1-10)</Label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={10}
                {...register("subjectiveQuality", { valueAsNumber: true })}
                className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-8 text-center font-semibold text-lg">
                {currentQuality}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Very Poor</span>
              <span>Excellent</span>
            </div>
            {errors.subjectiveQuality && (
              <p className="text-sm text-destructive">
                {errors.subjectiveQuality.message}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              {...register("notes")}
              placeholder="Any factors that affected your sleep..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting} className={onCancel ? "" : "w-full"}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditing ? "Update Entry" : "Save Entry"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
