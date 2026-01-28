import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-4xl">
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

        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user?.name}!</CardTitle>
            <CardDescription>
              {user?.onboardingCompleted
                ? "Your sleep journey continues"
                : "Let's get started with your personalized sleep program"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!user?.onboardingCompleted && (
              <p className="text-muted-foreground">
                Onboarding coming soon. For now, you're successfully authenticated!
              </p>
            )}
            {user?.onboardingCompleted && (
              <p className="text-muted-foreground">
                Your dashboard features are coming soon.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
