import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, MessageCircle } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/diary", label: "Diary", icon: BookOpen },
  { to: "/chat", label: "Coach", icon: MessageCircle },
] as const;

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-safe">
      <div className="flex h-14 items-center justify-around">
        {tabs.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
