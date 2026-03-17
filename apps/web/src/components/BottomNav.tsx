import { Link, useLocation } from "react-router-dom";
import { Home, MessageCircle, Settings } from "lucide-react";

const tabs = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/chat", label: "Coach", icon: MessageCircle, elevated: true },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function TabBar() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 glass-nav pb-safe">
      <div className="flex items-end justify-around px-6 pt-2 pb-2 max-w-lg mx-auto">
        {tabs.map(({ to, label, icon: Icon, ...rest }) => {
          const elevated = "elevated" in rest && rest.elevated;
          const isActive = location.pathname.startsWith(to);

          if (elevated) {
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center -mt-5 group"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${
                    isActive
                      ? "gradient-primary glow-primary scale-105"
                      : "bg-primary/80 hover:bg-primary group-hover:scale-105"
                  }`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center py-1 group"
            >
              <div
                className={`p-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
