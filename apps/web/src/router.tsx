import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { DiaryPage } from "@/features/diary";
import { ChatPage } from "@/features/chat";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { AppLayout } from "@/components/AppLayout";

export const router = createBrowserRouter([
  {
    // Root layout with AuthProvider
    element: <AppLayout />,
    children: [
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
            path: "/",
            element: <DashboardPage />,
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
            path: "/diary",
            element: <DiaryPage />,
          },
          {
            path: "/chat",
            element: <ChatPage />,
          },
        ],
      },
    ],
  },
]);
