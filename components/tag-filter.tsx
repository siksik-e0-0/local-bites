"use client";

import { MapPin, X } from "lucide-react";

export function TagFilter({
  tags,
  selected,
  onChange,
}: {
  tags: string[];
  selected: string | null;
  onChange: (tag: string | null) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        태그
      </span>
      {tags.map((t) => {
        const active = selected === t;
        return (
          <button
            key={t}
            onClick={() => onChange(active ? null : t)}
            className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                : "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)] hover:border-[var(--accent)]"
            }`}
          >
            <MapPin className="size-2.5" strokeWidth={2} />
            {t}
          </button>
        );
      })}
      {selected && (
        <button
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)]"
          title="태그 필터 해제"
        >
          <X className="size-2.5" strokeWidth={2} />
          해제
        </button>
      )}
    </div>
  );
}
