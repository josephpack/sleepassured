import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { InstallPrompt } from "./InstallPrompt";
import { TabBar } from "./BottomNav";

function updateNightMode() {
  const hour = new Date().getHours();
  const isNight = hour >= 21 || hour < 8;
  document.body.classList.toggle("night-mode", isNight);
}

export function MainLayout() {
  useEffect(() => {
    updateNightMode();
    const interval = setInterval(updateNightMode, 60_000);
    return () => clearInterval(interval);
  }, []);

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
