import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-10 w-full rounded-full border-2 border-input bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-10 rounded-full border-2 border-input bg-card px-3 text-sm text-foreground focus-visible:border-primary",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-bold", className)} {...props} />;
}

export function Checkbox({ className, label, ...props }: React.ComponentProps<"input"> & { label: React.ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm select-none", className)}>
      <input type="checkbox" className="size-4 accent-[var(--primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
