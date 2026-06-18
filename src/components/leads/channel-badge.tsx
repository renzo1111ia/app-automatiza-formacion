import { Check, X } from "lucide-react";

interface ChannelBadgeProps {
  active: boolean | null | undefined;
}

export function ChannelBadge({ active }: ChannelBadgeProps) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black tracking-widest text-emerald-600 uppercase dark:text-emerald-400">
        <Check className="h-3.5 w-3.5 stroke-[3]" />
        Sí
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-black tracking-widest text-rose-600 uppercase dark:text-rose-400">
      <X className="h-3.5 w-3.5 stroke-[3]" />
      No
    </span>
  );
}
