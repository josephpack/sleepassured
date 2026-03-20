import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminUsers, createAdminUser, AdminUserSummary } from "@/features/admin/api";
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

function CreateUserCard({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name || !email || !password) return;
    setCreating(true);
    setSuccess(null);
    setError(null);
    try {
      const result = await createAdminUser({ name, email, password });
      setSuccess({ name: result.user.name, email: result.user.email });
      setName("");
      setEmail("");
      setPassword("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create User</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="create-name">Name</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-password">Password</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Initial password"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleCreate} disabled={creating || !name || !email || !password}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
          {success && (
            <p className="text-sm text-green-600">
              Created {success.name} ({success.email})
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadUsers() {
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
  }

  useEffect(() => {
    loadUsers();
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
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Link>
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
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="space-y-6">
          {/* Create user form */}
          <CreateUserCard onCreated={loadUsers} />

          {/* User list */}
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
    </div>
  );
}
