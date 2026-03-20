import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProgressPage } from "@/pages/ProgressPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AdminPage } from "@/pages/AdminPage";
import { AdminUserPage } from "@/pages/AdminUserPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ChatPage } from "@/features/chat";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { AppLayout } from "@/components/AppLayout";
import { MainLayout } from "@/components/MainLayout";

export const router = createBrowserRouter([
  {
    // Root layout with AuthProvider
    element: <AppLayout />,
    children: [
      {
        // Redirect root to dashboard (handles service worker fallback)
        path: "/",
        element: <Navigate to="/dashboard" replace />,
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
              {
                path: "/progress",
                element: <ProgressPage />,
              },
              {
                path: "/settings",
                element: <SettingsPage />,
              },
            ],
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
      {
        // Catch-all: redirect unknown routes to dashboard
        path: "*",
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
