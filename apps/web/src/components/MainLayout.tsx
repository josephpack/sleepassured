import { Outlet } from "react-router-dom";
import { TabBar } from "./BottomNav";

export function MainLayout() {
  return (
    <div className="min-h-screen bg-muted/30">
      <TabBar />
      <Outlet />
    </div>
  );
}
