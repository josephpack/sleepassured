import { Outlet } from "react-router-dom";
import { InstallPrompt } from "./InstallPrompt";

export function MainLayout() {
  return (
    <div className="min-h-screen bg-background sa-mesh-bg">
      <InstallPrompt />
      <Outlet />
    </div>
  );
}
