import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { WhoopConnect } from "@/components/WhoopConnect";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and integrations
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Account</h2>
            <div className="bg-card rounded-lg border p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="text-sm font-medium">{user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user?.email}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Integrations Section */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Integrations</h2>
            <WhoopConnect />
          </section>
        </div>
      </div>
    </div>
  );
}
