import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { WhoopConnect } from "@/components/WhoopConnect";
import { ArrowLeft, LogOut, Shield, User, Link2 } from "lucide-react";
import { Link } from "react-router-dom";

export function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background sa-mesh-bg p-4 pb-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 sa-animate-in">
          <Button variant="ghost" size="sm" asChild className="rounded-xl hover:bg-muted/60 -ml-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="mb-8 sa-animate-in sa-stagger-1">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and integrations
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <section className="sa-animate-in sa-stagger-2">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Account</h2>
            </div>
            <div className="sa-card rounded-xl p-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="text-sm font-medium">{user?.name}</span>
                </div>
                <div className="h-px bg-border/60" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user?.email}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Integrations Section */}
          <section className="sa-animate-in sa-stagger-3">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Integrations</h2>
            </div>
            <div className="sa-card rounded-xl p-5">
              <WhoopConnect />
            </div>
          </section>

          {/* Admin */}
          {user?.isAdmin && (
            <section className="sa-animate-in sa-stagger-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Admin</h2>
              </div>
              <Button variant="outline" className="w-full rounded-xl h-11 border-border/60 hover:bg-primary/4 hover:border-primary/20 transition-colors" asChild>
                <Link to="/admin">
                  <Shield className="h-4 w-4 mr-2 text-primary" />
                  Admin Dashboard
                </Link>
              </Button>
            </section>
          )}

          {/* Sign Out */}
          <section className="pt-4 sa-animate-in sa-stagger-5">
            <div className="sa-divider mb-5">
              <span>session</span>
            </div>
            <Button
              variant="outline"
              className="w-full rounded-xl h-11 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
