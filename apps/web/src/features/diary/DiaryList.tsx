import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Pencil, Trash2, Moon, Sun } from "lucide-react";
import { getDiaryEntries, deleteDiaryEntry, DiaryEntry } from "./api";

interface DiaryListProps {
  onEdit?: (entry: DiaryEntry) => void;
  refreshTrigger?: number;
}

function formatDate(dateStr: string): string {
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
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 85) return "text-green-600";
  if (efficiency >= 75) return "text-yellow-600";
  return "text-red-600";
}

function getQualityLabel(quality: number): string {
  if (quality >= 8) return "Excellent";
  if (quality >= 6) return "Good";
  if (quality >= 4) return "Fair";
  return "Poor";
}

export function DiaryList({ onEdit, refreshTrigger }: DiaryListProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = async () => {
    try {
      // Get entries from the last 14 days
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const { entries } = await getDiaryEntries(twoWeeksAgo.toISOString().split("T")[0]);
      setEntries(entries);
    } catch (error) {
      console.error("Failed to load diary entries:", error);
      toast.error("Failed to load diary entries");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [refreshTrigger]);

  const handleDelete = async (entry: DiaryEntry) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    const dateStr = entry.date.split("T")[0]!;
    setDeletingId(entry.id);
    try {
      await deleteDiaryEntry(dateStr);
      toast.success("Entry deleted");
      loadEntries();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Moon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No diary entries yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start logging your sleep to track your progress
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Entries</CardTitle>
        <CardDescription>Your sleep diary from the past 2 weeks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{formatDate(entry.date)}</span>
                {entry.source === "WHOOP" && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    Auto
                  </span>
                )}
                {entry.source === "HYBRID" && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    WHOOP
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Moon className="h-3 w-3" />
                    <span>Bedtime</span>
                  </div>
                  <span className="font-medium">{formatTime(entry.bedtime)}</span>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Sun className="h-3 w-3" />
                    <span>Wake</span>
                  </div>
                  <span className="font-medium">{formatTime(entry.outOfBedTime)}</span>
                </div>

                <div>
                  <div className="text-muted-foreground">Sleep</div>
                  <span className="font-medium">
                    {formatDuration(entry.totalSleepTimeMins)}
                  </span>
                </div>

                <div>
                  <div className="text-muted-foreground">Efficiency</div>
                  <span
                    className={`font-medium ${getEfficiencyColor(Number(entry.sleepEfficiency))}`}
                  >
                    {Number(entry.sleepEfficiency).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Quality: {entry.subjectiveQuality}/10 ({getQualityLabel(entry.subjectiveQuality)})
                </span>
                {entry.numberOfAwakenings > 0 && (
                  <span>{entry.numberOfAwakenings} wake-up{entry.numberOfAwakenings > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 ml-4">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(entry)}
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(entry)}
                disabled={deletingId === entry.id}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                {deletingId === entry.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
