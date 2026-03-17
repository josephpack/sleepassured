import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { WhoopConnect } from "@/components/WhoopConnect";
import { LogOut, Shield, User, Link2 } from "lucide-react";
import { Link } from "react-router-dom";

export function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="px-4 pt-6 pb-10">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account and integrations
          </p>
        </div>

        <div className="space-y-5">
          {/* Account Section */}
          <section className="animate-fade-up stagger-1">
            <div className="flex items-center gap-2 mb-2.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account</h2>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="text-sm font-medium">{user?.name}</span>
                </div>
                <div className="divider" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user?.email}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Integrations Section */}
          <section className="animate-fade-up stagger-2">
            <div className="flex items-center gap-2 mb-2.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Integrations</h2>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <WhoopConnect />
            </div>
          </section>

          {/* Admin */}
          {user?.isAdmin && (
            <section className="animate-fade-up stagger-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</h2>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-xl h-11 border-border/50 hover:bg-primary/5 hover:border-primary/20 transition-colors"
                asChild
              >
                <Link to="/admin">
                  <Shield className="h-4 w-4 mr-2 text-primary" />
                  Admin Dashboard
                </Link>
              </Button>
            </section>
          )}

          {/* Sign Out */}
          <section className="pt-3 animate-fade-up stagger-4">
            <div className="divider mb-5" />
            <Button
              variant="outline"
              className="w-full rounded-xl h-11 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
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
