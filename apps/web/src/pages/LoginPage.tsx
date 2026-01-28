import { AuthLayout } from "@/components/AuthLayout";
import { LoginForm } from "@/features/auth/components/LoginForm";

export function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your SleepAssured account"
    >
      <LoginForm />
    </AuthLayout>
  );
}
