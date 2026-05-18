import { create } from "zustand";

export type DateRange = "7d" | "30d" | "90d" | "custom";

interface DateRangeState {
    range: DateRange;
    fromDate: string; // ISO
    toDate: string;   // ISO
    setRange: (range: DateRange) => void;
    setCustomRange: (from: string, to: string) => void;
}

function getRangeDates(range: DateRange): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString();
    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range] ?? 30;
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
}

export const useDateRangeStore = create<DateRangeState>((set) => {
    const { from, to } = getRangeDates("30d");
    return {
        range: "30d",
        fromDate: from,
        toDate: to,
        setRange: (range) => {
            const { from, to } = getRangeDates(range);
            set({ range, fromDate: from, toDate: to });
        },
        setCustomRange: (from, to) =>
            set({ range: "custom", fromDate: from, toDate: to }),
    };
});
