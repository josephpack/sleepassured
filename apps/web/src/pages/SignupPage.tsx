import { AuthLayout } from "@/components/AuthLayout";
import { SignupForm } from "@/features/auth/components/SignupForm";

export function SignupPage() {
  return (
    <AuthLayout
      title="Create an account"
      description="Start your journey to better sleep"
    >
      <SignupForm />
    </AuthLayout>
  );
}
