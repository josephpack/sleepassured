import { Link, useLocation } from "react-router-dom";
import { Home, MessageCircle } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/chat", label: "AI Coach", icon: MessageCircle },
] as const;

export function TabBar() {
  const location = useLocation();

  return (
    <nav className="flex gap-2 px-4 py-3">
      {tabs.map(({ to, label, icon: Icon }) => {
        const isActive =
          to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

        return (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
