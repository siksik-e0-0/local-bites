"use client";

import { UtensilsCrossed, Plus } from "lucide-react";

export function EmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
      <div className="grid size-14 place-items-center rounded-full border bg-[var(--subtle)]">
        <UtensilsCrossed className="size-6 text-[var(--muted)]" strokeWidth={1.5} />
      </div>
      <h3 className="mt-5 text-base font-medium">아직 후보가 없어요</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--muted)]">
        Naver 지도 단축 링크를 <code className="font-mono">share_link</code> 파일에 추가하면 카드로 표시됩니다.
      </p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--fg)] px-4 py-2 text-sm text-[var(--bg)] transition hover:opacity-90"
        >
          <Plus className="size-4" strokeWidth={2} />
          첫 장소 추가하기
        </button>
      )}
    </div>
  );
}
