import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { WhoopConnect } from "@/components/WhoopConnect";
import { AppleHealthConnect } from "@/components/AppleHealthConnect";
import { ArrowLeft, Download, LogOut, Share, Shield, Smartphone, User, Link2 } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Link, useNavigate } from "react-router-dom";

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { canInstall, isIos, hasNativePrompt, install } = usePwaInstall();

  return (
    <div className="px-4 pt-6 pb-10">
      <div className="mx-auto max-w-lg">
        {/* Back button */}
        <div className="mb-4 animate-fade-up">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

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
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-5">
                <WhoopConnect />
              </div>
              <div className="glass-card rounded-2xl p-5">
                <AppleHealthConnect />
              </div>
            </div>
          </section>

          {/* Add to Home Screen */}
          {canInstall && (
            <section className="animate-fade-up stagger-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">App</h2>
              </div>
              <div className="glass-card rounded-2xl p-5">
                {hasNativePrompt ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Download className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Add to Home Screen</p>
                      <p className="text-xs text-muted-foreground">
                        Install for quick access
                      </p>
                    </div>
                    <Button size="sm" onClick={install} className="shrink-0">
                      Install
                    </Button>
                  </div>
                ) : isIos ? (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Download className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Add to Home Screen</p>
                        <p className="text-xs text-muted-foreground">
                          Install for quick access
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 ml-1">
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                          1
                        </span>
                        <span>
                          Tap the <Share className="inline h-4 w-4 align-text-bottom mx-0.5" /> Share button
                          at the bottom of Safari
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                          2
                        </span>
                        <span>
                          Scroll down and tap <strong>Add to Home Screen</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          )}

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
