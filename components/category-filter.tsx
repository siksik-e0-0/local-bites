"use client";

import { Coffee, LayoutGrid, Sparkles, UtensilsCrossed } from "lucide-react";
import type { Category } from "@/lib/types";

export type FilterValue = Category | "전체";

const OPTIONS: { value: FilterValue; label: string; Icon: typeof LayoutGrid }[] = [
  { value: "전체", label: "전체", Icon: LayoutGrid },
  { value: "식당", label: "식당", Icon: UtensilsCrossed },
  { value: "카페", label: "카페", Icon: Coffee },
  { value: "기타", label: "기타", Icon: Sparkles },
];

export function CategoryFilter({
  value,
  onChange,
  counts,
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  counts: Record<FilterValue, number>;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 rounded-full border bg-[var(--subtle)] p-1"
    >
      {OPTIONS.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all",
              "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
              active
                ? "bg-[var(--fg)] text-[var(--bg)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--fg)]",
            ].join(" ")}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
            <span>{label}</span>
            <span
              className={[
                "ml-0.5 rounded-full px-1.5 text-[10px] tabular-nums",
                active ? "bg-white/15 text-[var(--bg)]" : "bg-[var(--bg)] text-[var(--muted)]",
              ].join(" ")}
            >
              {counts[v] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
