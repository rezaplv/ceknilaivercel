import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** Floating fixed position with safe spacing from headers and bottom navigation */
  floating?: boolean;
  className?: string;
}

export function ThemeToggle({ floating = false, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        "w-11 h-11 bg-card/95 backdrop-blur border border-border/60 shadow-lg",
        "text-foreground/80 hover:text-foreground hover:bg-card",
        "transition-all duration-200 active:scale-95",
        floating &&
          "fixed z-30 right-3 sm:right-4 lg:right-6 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] sm:bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-6",
        className
      )}
    >
      <span className="relative inline-flex w-5 h-5 items-center justify-center">
        <Sun
          className={cn(
            "absolute w-5 h-5 transition-all duration-300",
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
          )}
        />
        <Moon
          className={cn(
            "absolute w-5 h-5 transition-all duration-300",
            isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
          )}
        />
      </span>
    </button>
  );
}
