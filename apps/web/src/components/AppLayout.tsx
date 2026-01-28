import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

export function AppLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
