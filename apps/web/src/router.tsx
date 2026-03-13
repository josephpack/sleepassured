import { Navigate } from "react-router-dom";
import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LandingPage } from "@/pages/LandingPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AdminPage } from "@/pages/AdminPage";
import { AdminUserPage } from "@/pages/AdminUserPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ChatPage } from "@/features/chat";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { AppLayout } from "@/components/AppLayout";
import { MainLayout } from "@/components/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

function LandingRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}

export const router = createBrowserRouter([
  {
    // Root layout with AuthProvider
    element: <AppLayout />,
    children: [
      {
        // Landing page (public — redirects authenticated users to /dashboard)
        path: "/",
        element: <LandingRoute />,
      },
      {
        // Public routes (redirect to dashboard if authenticated)
        element: <PublicRoute />,
        children: [
          {
            path: "/login",
            element: <LoginPage />,
          },
          {
            path: "/signup",
            element: <SignupPage />,
          },
        ],
      },
      {
        // Protected routes (redirect to login if not authenticated)
        element: <ProtectedRoute />,
        children: [
          {
            // Tabbed pages with bottom navigation
            element: <MainLayout />,
            children: [
              {
                path: "/dashboard",
                element: <DashboardPage />,
              },
              {
                path: "/chat",
                element: <ChatPage />,
              },
            ],
          },
          {
            path: "/settings",
            element: <SettingsPage />,
          },
          {
            path: "/onboarding",
            element: <OnboardingPage />,
          },
          {
            path: "/admin",
            element: <AdminPage />,
          },
          {
            path: "/admin/users/:id",
            element: <AdminUserPage />,
          },
        ],
      },
    ],
  },
]);
