import { Link, useLocation } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home" },
  { to: "/diary", label: "Diary" },
  { to: "/chat", label: "AI Coach" },
] as const;

export function TabBar() {
  const location = useLocation();

  return (
    <nav className="flex gap-2 px-4 py-3">
      {tabs.map(({ to, label }) => {
        const isActive =
          to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

        return (
          <Link
            key={to}
            to={to}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
