import { cn } from "@/lib/utils";

/** Full-width depleting bar: `fraction` is the portion of the period remaining (1..0). */
export function CountdownBar({ fraction, urgent }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-1000 ease-linear",
          urgent ? "bg-destructive" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
