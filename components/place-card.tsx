"use client";

import {
  Bookmark,
  Clock,
  Coffee,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  Star,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";
import type { Category, Place } from "@/lib/types";

const CATEGORY_META: Record<Category, { Icon: typeof UtensilsCrossed; label: string }> = {
  식당: { Icon: UtensilsCrossed, label: "식당" },
  카페: { Icon: Coffee, label: "카페" },
  기타: { Icon: Sparkles, label: "기타" },
};

function Monogram({ name, category }: { name: string; category: Category }) {
  const ch = (name?.[0] ?? "·").toUpperCase();
  return (
    <div className="grid size-full place-items-center bg-gradient-to-br from-[var(--subtle)] to-[var(--bg)]">
      <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
        <span className="font-mono text-5xl font-light tracking-tight">{ch}</span>
        <span className="text-[10px] uppercase tracking-[0.2em]">{CATEGORY_META[category].label}</span>
      </div>
    </div>
  );
}

export function PlaceCard({
  place,
  index,
  isAdmin,
  adminToken,
  scrapped,
  onSelect,
  onEdit,
  onDeleted,
  onToggleScrap,
}: {
  place: Place;
  index: number;
  isAdmin: boolean;
  adminToken: string | null;
  scrapped: boolean;
  onSelect: (place: Place) => void;
  onEdit: (place: Place) => void;
  onDeleted: (id: string) => void;
  onToggleScrap: (id: string) => void;
}) {
  const { Icon } = CATEGORY_META[place.category];
  const rating = place.rating != null ? place.rating.toFixed(1) : null;
  const tags = place.tags ?? [];
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!adminToken) {
      setDelError("관리자 토큰 없음");
      return;
    }
    if (!confirm(`'${place.name}' 카드를 삭제할까요?\nshare_link 에서도 제거됩니다.`)) return;
    setDeleting(true);
    setDelError(null);
    try {
      const res = await fetch("/api/places/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ id: place.id, shortUrl: place.shortUrl }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setDelError(data.error ?? "삭제 실패");
        setDeleting(false);
        return;
      }
      onDeleted(place.id);
    } catch (err) {
      setDelError(`네트워크 오류: ${(err as Error).message}`);
      setDeleting(false);
    }
  }

  return (
    <article
      onClick={() => onSelect(place)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(place);
        }
      }}
      className="lb-card-enter group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-[var(--card)] text-left transition-all hover:-translate-y-0.5 hover:border-[var(--fg)]/30 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
      style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b bg-[var(--subtle)]">
        {place.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.heroImageUrl}
            alt={place.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <Monogram name={place.name} category={place.category} />
        )}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/70 px-2 py-1 text-[11px] font-medium text-neutral-800 backdrop-blur-md dark:bg-black/40 dark:text-neutral-100">
          <Icon className="size-3" strokeWidth={2} />
          {place.category}
        </div>
        {place.source !== "naver" && (
          <div className="absolute right-3 top-3 rounded-full border border-amber-400/40 bg-amber-50/90 px-2 py-1 text-[10px] font-medium text-amber-900 backdrop-blur-md">
            데이터 갱신 필요
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleScrap(place.id);
          }}
          aria-label={scrapped ? "스크랩 해제" : "스크랩"}
          title={scrapped ? "스크랩 해제" : "스크랩"}
          className={`absolute ${place.source !== "naver" ? "right-3 top-12" : "right-3 top-3"} grid size-8 place-items-center rounded-full border backdrop-blur-md transition ${
            scrapped
              ? "border-[var(--accent)]/60 bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
              : "border-white/40 bg-white/70 text-neutral-700 hover:bg-white dark:bg-black/40 dark:text-neutral-200 dark:hover:bg-black/60"
          }`}
        >
          <Bookmark
            className={`size-3.5 ${scrapped ? "fill-current" : ""}`}
            strokeWidth={1.75}
          />
        </button>
        {isAdmin && (
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(place);
              }}
              aria-label="편집"
              title="편집"
              className="grid size-8 place-items-center rounded-full border border-white/40 bg-white/85 text-neutral-800 backdrop-blur-md transition hover:bg-white dark:bg-black/55 dark:text-neutral-100 dark:hover:bg-black/75"
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="삭제"
              title="삭제"
              className="grid size-8 place-items-center rounded-full border border-red-300/60 bg-red-50/90 text-red-700 backdrop-blur-md transition hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/60 dark:text-red-200"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium tracking-tight">{place.name}</h3>
            {place.naverCategory && (
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{place.naverCategory}</p>
            )}
          </div>
          {rating && (
            <div className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--subtle)] px-1.5 py-1 text-xs">
              <Star className="size-3 fill-current text-amber-500" strokeWidth={0} />
              <span className="tabular-nums">{rating}</span>
              {place.reviewCount != null && (
                <span className="text-[var(--muted)]">· {place.reviewCount.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)] dark:text-[var(--accent)]"
              >
                <MapPin className="size-2.5" strokeWidth={2} />
                {t}
              </span>
            ))}
          </div>
        )}

        {place.description && (
          <p className="line-clamp-3 whitespace-pre-wrap rounded-md bg-[var(--subtle)]/60 px-2.5 py-1.5 text-xs leading-relaxed text-[var(--fg)]/80">
            {place.description}
          </p>
        )}

        <dl className="space-y-1.5 text-sm">
          {place.address && (
            <div className="flex items-start gap-2 text-[var(--muted)]">
              <MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} />
              <span className="line-clamp-2 text-[var(--fg)]/80">{place.address}</span>
            </div>
          )}
          {place.phone && (
            <div className="flex items-start gap-2 text-[var(--muted)]">
              <Phone className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} />
              <a
                href={`tel:${place.phone.replace(/[^0-9+]/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-xs text-[var(--fg)]/80 hover:underline"
              >
                {place.phone}
              </a>
            </div>
          )}
          {place.businessHours && (
            <div className="flex items-start gap-2 text-[var(--muted)]">
              <Clock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} />
              <span className="line-clamp-2 whitespace-pre-wrap text-[var(--fg)]/80">
                {place.businessHours}
              </span>
            </div>
          )}
        </dl>

        {delError && (
          <p className="text-[10px] text-red-600 dark:text-red-300">{delError}</p>
        )}

        <a
          href={place.naverMapUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border bg-[var(--bg)] py-2 text-sm text-[var(--fg)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Naver지도에서 보기
          <ExternalLink className="size-3.5" strokeWidth={1.75} />
        </a>
      </div>
    </article>
  );
}
