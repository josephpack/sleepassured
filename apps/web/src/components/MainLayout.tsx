import { Outlet } from "react-router-dom";
import { InstallPrompt } from "./InstallPrompt";

export function MainLayout() {
  return (
    <div className="min-h-screen bg-muted/30">
      <InstallPrompt />
      <Outlet />
    </div>
  );
}
