export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="14" cy="15.5" r="10" fill="hsl(16 52% 62%)" />
      <circle cx="19" cy="12" r="8.8" fill="hsl(30 8% 7%)" />
      <circle cx="9" cy="9" r="1.2" fill="hsl(36 55% 51%)" opacity="0.9" />
      <circle cx="7" cy="14.5" r="0.8" fill="hsl(36 55% 51%)" opacity="0.6" />
      <circle cx="12" cy="7" r="0.9" fill="hsl(36 55% 51%)" opacity="0.75" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="h-6 w-6" />
      <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
        SleepAssured
      </span>
    </div>
  );
}
