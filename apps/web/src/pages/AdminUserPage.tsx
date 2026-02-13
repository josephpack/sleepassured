import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAdminUser,
  AdminUserDetail,
  DiaryEntry,
  SleepWindowEntry,
  ISIAssessmentEntry,
} from "@/features/admin/api";
import { ApiError } from "@/lib/api";

function StatusChip({ label, active, variant = "default" }: {
  label: string;
  active: boolean;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  if (!active) return null;
  const colours: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colours[variant]}`}>
      {label}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isiSeverity(score: number): string {
  if (score <= 7) return "No clinically significant insomnia";
  if (score <= 14) return "Subthreshold insomnia";
  if (score <= 21) return "Moderate clinical insomnia";
  return "Severe clinical insomnia";
}

function formatMinsAsHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function DiaryTable({ entries }: { entries: DiaryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No diary entries yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">SE</th>
            <th className="pb-2 pr-4">TST</th>
            <th className="pb-2 pr-4">Quality</th>
            <th className="pb-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((d) => (
            <tr key={d.date} className="border-b last:border-0">
              <td className="py-2 pr-4">{formatDate(d.date)}</td>
              <td className="py-2 pr-4">{d.sleepEfficiency.toFixed(1)}%</td>
              <td className="py-2 pr-4">{formatMinsAsHM(d.totalSleepTimeMins)}</td>
              <td className="py-2 pr-4">{d.subjectiveQuality}/10</td>
              <td className="py-2">{d.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WindowsTable({ windows }: { windows: SleepWindowEntry[] }) {
  if (windows.length === 0) {
    return <p className="text-sm text-muted-foreground">No sleep windows yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4">Week</th>
            <th className="pb-2 pr-4">Bedtime</th>
            <th className="pb-2 pr-4">Wake</th>
            <th className="pb-2 pr-4">TIB</th>
            <th className="pb-2 pr-4">Avg SE</th>
            <th className="pb-2">Adjustment</th>
          </tr>
        </thead>
        <tbody>
          {windows.map((w) => (
            <tr key={w.weekStartDate} className="border-b last:border-0">
              <td className="py-2 pr-4">{formatDate(w.weekStartDate)}</td>
              <td className="py-2 pr-4">{w.prescribedBedtime}</td>
              <td className="py-2 pr-4">{w.prescribedWakeTime}</td>
              <td className="py-2 pr-4">{formatMinsAsHM(w.timeInBedMins)}</td>
              <td className="py-2 pr-4">
                {w.avgSleepEfficiency !== null ? `${w.avgSleepEfficiency.toFixed(1)}%` : "—"}
              </td>
              <td className="py-2">{w.adjustmentMade ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ISIList({ assessments }: { assessments: ISIAssessmentEntry[] }) {
  if (assessments.length === 0) {
    return <p className="text-sm text-muted-foreground">No ISI assessments yet.</p>;
  }
  return (
    <div className="space-y-2">
      {assessments.map((a) => (
        <div key={a.completedAt} className="flex items-center justify-between text-sm">
          <span>{formatDate(a.completedAt)}</span>
          <span className="font-medium">
            {a.score}/28 — {isiSeverity(a.score)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getAdminUser(id)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You do not have permission to view this page.");
        } else if (err instanceof ApiError && err.status === 404) {
          setError("User not found.");
        } else {
          setError("Failed to load user.");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin"><ArrowLeft className="h-4 w-4" /> Back to Admin</Link>
            </Button>
          </div>
          <p className="text-destructive">{error ?? "Something went wrong."}</p>
        </div>
      </div>
    );
  }

  const { user, diaryEntries, sleepWindows, isiAssessments } = data;

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin"><ArrowLeft className="h-4 w-4" /> Back to Admin</Link>
          </Button>
        </div>

        {/* User header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <StatusChip label="Onboarded" active={user.onboardingCompleted} variant="success" />
            <StatusChip label="Baseline" active={user.baselineComplete} variant="success" />
            <StatusChip label="WHOOP" active={user.whoopConnected} variant="default" />
            <StatusChip label="Flagged" active={user.flaggedForReview} variant="danger" />
          </div>
          {user.flaggedReason && (
            <p className="mt-1 text-sm text-red-600">Reason: {user.flaggedReason}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>Joined: {formatDate(user.createdAt)}</span>
            {user.therapyStartDate && <span>Therapy started: {formatDate(user.therapyStartDate)}</span>}
            <span>Diaries: {user.diaryCount}</span>
            {user.latestSleepEfficiency !== null && (
              <span>Latest SE: {user.latestSleepEfficiency.toFixed(1)}%</span>
            )}
            {user.latestIsiScore !== null && (
              <span>Latest ISI: {user.latestIsiScore}</span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Diary entries */}
          <Card>
            <CardHeader>
              <CardTitle>Sleep Diary (last 14 entries)</CardTitle>
            </CardHeader>
            <CardContent>
              <DiaryTable entries={diaryEntries} />
            </CardContent>
          </Card>

          {/* Sleep windows */}
          <Card>
            <CardHeader>
              <CardTitle>Sleep Windows</CardTitle>
            </CardHeader>
            <CardContent>
              <WindowsTable windows={sleepWindows} />
            </CardContent>
          </Card>

          {/* ISI assessments */}
          <Card>
            <CardHeader>
              <CardTitle>ISI Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              <ISIList assessments={isiAssessments} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
