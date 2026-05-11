import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({ title, subtitle, icon: Icon = Inbox, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-8 text-center",
        className,
      )}
    >
      <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">{title}</p>
      {subtitle ? <p className="mt-1 text-xs font-medium text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}