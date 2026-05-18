import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
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
    <div className={cn(
      "min-w-[220px] rounded-2xl bg-black/80 backdrop-blur-xl border-2 transition-all duration-300 shadow-2xl",
      selected ? "border-primary ring-4 ring-primary/20 scale-105" : "border-white/10 hover:border-white/20",
    )}>
      {/* Node Header */}
      <div className={cn(
        "flex items-center gap-2.5 px-4 py-3 rounded-t-2xl border-b border-white/5",
        colorClass ? `${colorClass}/10` : "bg-white/5"
      )}>
        <div className={cn("h-8 w-8 flex items-center justify-center rounded-xl", 
          colorClass ? `${colorClass}/20 ${colorClass.replace('bg-', 'text-')}` : "bg-white/10 text-white"
        )}>
          {icon}
        </div>
        <span className="font-bold text-sm tracking-tight text-white/90 uppercase">{label}</span>
      </div>

      {/* Node Content */}
      <div className="p-4 space-y-3 text-xs text-white/60">
        {children}
      </div>

      {/* Footer Decoration */}
      <div className="h-1 w-1/3 bg-primary/40 mx-auto rounded-full mb-1 opacity-20" />
    </div>
  );
});

BaseNode.displayName = 'BaseNode';
