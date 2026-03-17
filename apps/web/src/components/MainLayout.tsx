import { Outlet } from "react-router-dom";
import { InstallPrompt } from "./InstallPrompt";
import { TabBar } from "./BottomNav";

export function MainLayout() {
  return (
    <>
      <div className="min-h-screen bg-background gradient-mesh">
        <InstallPrompt />
        <Outlet />
        {/* Spacer to prevent content from hiding behind fixed nav */}
        <div style={{ height: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }} />
      </div>
      {/* TabBar must be outside gradient-mesh to avoid its stacking context trapping position:fixed */}
      <TabBar />
    </>
  );
}
