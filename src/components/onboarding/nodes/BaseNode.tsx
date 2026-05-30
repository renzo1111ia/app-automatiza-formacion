import React, { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * BASE NODE COMPONENT - COMFYUI STYLE
 * Shared visual style for all nodal builder components.
 */

interface BaseNodeProps {
  label: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  colorClass?: string;
  selected?: boolean;
}

export const BaseNode = memo(({ label, icon, children, colorClass, selected }: BaseNodeProps) => {
  return (
    <div
      className={cn(
        "min-w-[220px] rounded-2xl border-2 bg-black/80 shadow-2xl backdrop-blur-xl transition-all duration-300",
        selected
          ? "border-primary ring-primary/20 scale-105 ring-4"
          : "border-white/10 hover:border-white/20"
      )}
    >
      {/* Node Header */}
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-t-2xl border-b border-white/5 px-4 py-3",
          colorClass ? `${colorClass}/10` : "bg-white/5"
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            colorClass
              ? `${colorClass}/20 ${colorClass.replace("bg-", "text-")}`
              : "bg-white/10 text-white"
          )}
        >
          {icon}
        </div>
        <span className="text-sm font-bold tracking-tight text-white/90 uppercase">{label}</span>
      </div>

      {/* Node Content */}
      <div className="space-y-3 p-4 text-xs text-white/60">{children}</div>

      {/* Footer Decoration */}
      <div className="bg-primary/40 mx-auto mb-1 h-1 w-1/3 rounded-full opacity-20" />
    </div>
  );
});

BaseNode.displayName = "BaseNode";
