"use client";

import { Plus, X } from "lucide-react";
import type { MenuItem } from "@/lib/types";

export function MenuEditor({
  items,
  onChange,
  disabled,
  max = 30,
}: {
  items: MenuItem[];
  onChange: (next: MenuItem[]) => void;
  disabled?: boolean;
  max?: number;
}) {
  function update(i: number, patch: Partial<MenuItem>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    if (items.length >= max) return;
    onChange([...items, { name: "", price: null, description: null, imageUrl: null }]);
  }

  return (
    <div className="space-y-1.5">
      {items.length === 0 && (
        <p className="text-[11px] text-[var(--muted)]">
          메뉴를 추가하면 카드 상세에 표시됩니다.
        </p>
      )}
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={it.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="메뉴 이름"
            disabled={disabled}
            maxLength={80}
            className="flex-[2] rounded-md border bg-[var(--bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
          />
          <input
            value={it.price ?? ""}
            onChange={(e) => update(i, { price: e.target.value || null })}
            placeholder="가격"
            disabled={disabled}
            maxLength={40}
            inputMode="text"
            className="w-24 rounded-md border bg-[var(--bg)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={disabled}
            aria-label="삭제"
            className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[var(--subtle)] hover:text-red-600 disabled:opacity-50"
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled || items.length >= max}
        className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-[11px] text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)] disabled:opacity-50"
      >
        <Plus className="size-3" strokeWidth={1.75} />
        메뉴 추가
      </button>
    </div>
  );
}
