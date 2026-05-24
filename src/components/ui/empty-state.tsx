import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  /**
   * Visual size. Default "md" works inside dashboard panels;
   * "sm" for inline use in cards/lists; "lg" for full-page empty states.
   */
  size?: "sm" | "md" | "lg";
}

/**
 * Reusable empty-state block. Communicates absence of data without
 * resorting to alerts or error popups. Accessible: role="status" so
 * screen readers announce it as informational, not as an error.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const padding = size === "lg" ? "px-6 py-16" : size === "sm" ? "px-4 py-8" : "px-5 py-12";
  const titleSize = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/40 text-center dark:border-slate-700 dark:bg-slate-900/30",
        padding,
        className
      )}
    >
      {icon && (
        <div className="text-slate-400 dark:text-slate-500" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className={cn("font-semibold text-slate-700 dark:text-slate-200", titleSize)}>
          {title}
        </h3>
        {description && (
          <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
