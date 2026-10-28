import { cn } from "@/lib/utils";

/** Logo propio de PixelPeso: una moneda con un "píxel" y el signo $. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <rect x="2" y="2" width="28" height="28" rx="9" fill="var(--primary)" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.5" />
        <path
          d="M18.6 12.6c-.6-.9-1.6-1.4-2.7-1.4-1.6 0-2.8.9-2.8 2.2 0 3 5.8 1.6 5.8 4.6 0 1.3-1.2 2.3-2.9 2.3-1.2 0-2.3-.5-3-1.5M16 9.6v12.8"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="23" y="5" width="4" height="4" rx="1" fill="var(--primary-foreground)" />
      </svg>
      <span className="text-xl">
        Pixel<span className="text-primary">Peso</span>
      </span>
    </span>
  );
}
