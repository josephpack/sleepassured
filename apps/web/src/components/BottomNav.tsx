import { Link, useLocation } from "react-router-dom";
import { Home, MessageCircle, BarChart3, Settings } from "lucide-react";

const tabs = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/chat", label: "Coach", icon: MessageCircle },
  { to: "/dashboard", label: "Progress", icon: BarChart3 }, // TODO: Progress page — link to /progress when built
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function TabBar() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 surface-nav pb-safe">
      <div className="flex items-center justify-around px-4 pt-2 pb-2 max-w-lg mx-auto">
        {tabs.map(({ to, label, icon: Icon }) => {
          const isActive =
            label === "Progress"
              ? false // Progress tab is not active until the page exists
              : location.pathname.startsWith(to);

          return (
            <Link
              key={label}
              to={to}
              className="flex flex-col items-center py-1 group min-w-[3.5rem]"
            >
              <Icon
                className={`h-5 w-5 transition-colors duration-200 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              <span
                className={`text-[10px] mt-1 font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {/* Active indicator pip */}
              <div
                className={`h-1 w-1 rounded-full mt-0.5 transition-all duration-200 ${
                  isActive ? "bg-primary scale-100" : "bg-transparent scale-0"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
