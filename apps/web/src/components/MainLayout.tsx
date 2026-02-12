import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <div className="min-h-screen bg-muted/30">
      <Outlet />
    </div>
  );
}
