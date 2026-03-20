import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminUser,
  updateAdminUser,
  adminSyncWhoop,
  adminTriggerAdjustment,
  adminResetPassword,
  deleteAdminUser,
  AdminUserDetail,
  DiaryEntry,
  SleepWindowEntry,
  ISIAssessmentEntry,
  SyncResult,
  AdjustmentResult,
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

function AdminActionsCard({
  user,
  onUserUpdated,
  onDeleted,
}: {
  user: AdminUserDetail["user"];
  onUserUpdated: (updates: Partial<AdminUserDetail["user"]>) => void;
  onDeleted: () => void;
}) {
  const [notes, setNotes] = useState(user.adminNotes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const [unflagging, setUnflagging] = useState(false);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustResult, setAdjustResult] = useState<AdjustmentResult | null>(null);

  const [resetPw, setResetPw] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleUnflag() {
    setUnflagging(true);
    try {
      await updateAdminUser(user.id, { flaggedForReview: false });
      onUserUpdated({ flaggedForReview: false, flaggedReason: null });
    } finally {
      setUnflagging(false);
    }
  }

  async function handleSaveNotes() {
    setNotesSaving(true);
    setNotesSaved(false);
    try {
      await updateAdminUser(user.id, { adminNotes: notes });
      onUserUpdated({ adminNotes: notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally {
      setNotesSaving(false);
    }
  }

  async function handleSyncWhoop() {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const result = await adminSyncWhoop(user.id);
      setSyncResult(result);
    } catch (err) {
      setSyncResult({
        userId: user.id,
        success: false,
        error: err instanceof ApiError ? err.message : "Sync failed",
      });
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleTriggerAdjustment() {
    setAdjustLoading(true);
    setAdjustResult(null);
    try {
      const result = await adminTriggerAdjustment(user.id);
      setAdjustResult(result);
    } catch (err) {
      setAdjustResult({
        userId: user.id,
        success: false,
        error: err instanceof ApiError ? err.message : "Adjustment failed",
      });
    } finally {
      setAdjustLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!resetPw) return;
    setResetLoading(true);
    setResetDone(false);
    setResetError(null);
    try {
      await adminResetPassword(user.id, resetPw);
      setResetDone(true);
      setResetPw("");
      setTimeout(() => setResetDone(false), 3000);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteAdminUser(user.id);
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Delete failed");
      setDeleteLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Flag status */}
        {user.flaggedForReview && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                Flagged for review
              </span>
              {user.flaggedReason && (
                <span className="text-sm text-muted-foreground">— {user.flaggedReason}</span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleUnflag} disabled={unflagging}>
              {unflagging && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Unflag User
            </Button>
          </div>
        )}

        {/* Admin notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Admin Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes about this user..."
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSaveNotes} disabled={notesSaving}>
              {notesSaving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Save Notes
            </Button>
            {notesSaved && <span className="text-sm text-green-600">Saved</span>}
          </div>
        </div>

        {/* Job triggers */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Job Triggers</label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleSyncWhoop} disabled={syncLoading}>
              {syncLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Sync WHOOP
            </Button>
            <Button size="sm" variant="outline" onClick={handleTriggerAdjustment} disabled={adjustLoading}>
              {adjustLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Trigger Adjustment
            </Button>
          </div>
          {syncResult && (
            <p className={`text-sm ${syncResult.success ? "text-green-600" : "text-red-600"}`}>
              {syncResult.success
                ? `${syncResult.recordsSynced} record${syncResult.recordsSynced !== 1 ? "s" : ""} synced`
                : `Sync failed: ${syncResult.error}`}
            </p>
          )}
          {adjustResult && (
            <p className={`text-sm ${adjustResult.success ? "text-green-600" : "text-red-600"}`}>
              {adjustResult.success
                ? `${adjustResult.action} — TIB adjusted to ${formatMinsAsHM(adjustResult.newTIB!)} (avg SE: ${adjustResult.avgSleepEfficiency?.toFixed(1)}%)`
                : `Adjustment failed: ${adjustResult.error}`}
            </p>
          )}
        </div>

        {/* Password reset */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Reset Password</label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              placeholder="New password"
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" onClick={handleResetPassword} disabled={resetLoading || !resetPw}>
              {resetLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Reset Password
            </Button>
          </div>
          {resetDone && <p className="text-sm text-green-600">Password reset successfully</p>}
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
        </div>

        {/* Delete user */}
        <div className="space-y-2 border-t pt-4">
          <label className="text-sm font-medium text-destructive">Danger Zone</label>
          {!deleteConfirm ? (
            <div>
              <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(true)}>
                Delete User
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This will permanently delete <strong>{user.name}</strong> and all their data. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                  {deleteLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Confirm Delete
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(false)} disabled={deleteLoading}>
                  Cancel
                </Button>
              </div>
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  function handleUserUpdated(updates: Partial<AdminUserDetail["user"]>) {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, user: { ...prev.user, ...updates } };
    });
  }

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
          {/* Admin actions */}
          <AdminActionsCard user={user} onUserUpdated={handleUserUpdated} onDeleted={() => navigate("/admin")} />

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
