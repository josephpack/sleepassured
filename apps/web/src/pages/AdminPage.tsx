import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAdminUsers, AdminUserSummary } from "@/features/admin/api";
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

export function AdminPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers()
      .then((data) => setUsers(data.users))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("You do not have permission to view this page.");
        } else {
          setError("Failed to load users.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Link>
            </Button>
          </div>
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="space-y-3">
          {users.map((u) => (
            <Link key={u.id} to={`/admin/users/${u.id}`} className="block">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      <StatusChip label="Onboarded" active={u.onboardingCompleted} variant="success" />
                      <StatusChip label="Baseline" active={u.baselineComplete} variant="success" />
                      <StatusChip label="WHOOP" active={u.whoopConnected} variant="default" />
                      <StatusChip label="Flagged" active={u.flaggedForReview} variant="danger" />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>Diaries: {u.diaryCount}</span>
                    <span>Last entry: {formatDate(u.lastDiaryDate)}</span>
                    {u.latestSleepEfficiency !== null && (
                      <span>SE: {u.latestSleepEfficiency.toFixed(1)}%</span>
                    )}
                    {u.latestIsiScore !== null && (
                      <span>ISI: {u.latestIsiScore}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
