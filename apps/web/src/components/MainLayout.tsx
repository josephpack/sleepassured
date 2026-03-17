import { Outlet } from "react-router-dom";
import { InstallPrompt } from "./InstallPrompt";
import { TabBar } from "./BottomNav";

export function MainLayout() {
  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <InstallPrompt />
      {/* Content area with bottom padding for fixed nav */}
      <div className="pb-20 pb-safe">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}
