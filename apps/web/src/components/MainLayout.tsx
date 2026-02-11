import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function MainLayout() {
  return (
    <div className="pb-20">
      <Outlet />
      <BottomNav />
    </div>
  );
}
