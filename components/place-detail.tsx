"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  Send,
  Sparkles,
  Star,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Place, PlaceComment } from "@/lib/types";

const CAT_ICON: Record<Category, typeof UtensilsCrossed> = {
  식당: UtensilsCrossed,
  카페: Coffee,
  기타: Sparkles,
};

function formatRelativeKst(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMin = Math.floor((now - d.getTime()) / 60000);
    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}시간 전`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}일 전`;
    const fmt = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(d);
  } catch {
    return iso;
  }
}

export function PlaceDetail({
  place,
  isAdmin,
  likeCount,
  liked,
  scrapped,
  comments,
  onClose,
  onEdit,
  onToggleLike,
  onToggleScrap,
  onAddComment,
  onRemoveComment,
}: {
  place: Place | null;
  isAdmin: boolean;
  likeCount: number;
  liked: boolean;
  scrapped: boolean;
  comments: PlaceComment[];
  onClose: () => void;
  onEdit: (place: Place) => void;
  onToggleLike: (id: string) => void;
  onToggleScrap: (id: string) => void;
  onAddComment: (id: string, text: string) => Promise<string | null>;
  onRemoveComment: (id: string, commentId: string) => Promise<string | null>;
}) {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!place) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [place, onClose]);

  useEffect(() => {
    if (place) {
      setCommentText("");
      setPostError(null);
    }
  }, [place]);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [comments],
  );

  if (!place) return null;

  const Icon = CAT_ICON[place.category];
  const images = place.images && place.images.length > 0
    ? place.images
    : (place.heroImageUrl ? [place.heroImageUrl] : []);
  const tags = place.tags ?? [];
  const rating = place.rating != null ? place.rating.toFixed(1) : null;

  const scrollTo = (i: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(i, images.length - 1));
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    setActiveIdx(target);
  };

  const dirUrl = `https://map.naver.com/p/directions/-/-/${place.id}/-/transit`;

  async function handlePost() {
    if (!place) return;
    setPosting(true);
    setPostError(null);
    const err = await onAddComment(place.id, commentText);
    setPosting(false);
    if (err) {
      setPostError(err);
      return;
    }
    setCommentText("");
  }

  async function handleRemove(commentId: string) {
    if (!place) return;
    if (!confirm("이 댓글을 삭제할까요?")) return;
    setRemovingId(commentId);
    const err = await onRemoveComment(place.id, commentId);
    setRemovingId(null);
    if (err) setPostError(err);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border bg-[var(--card)] shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 shrink-0 text-[var(--muted)]" strokeWidth={1.5} />
            <h2 className="truncate text-base font-medium tracking-tight">{place.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => onToggleScrap(place.id)}
              aria-label={scrapped ? "스크랩 해제" : "스크랩"}
              title={scrapped ? "스크랩 해제" : "스크랩"}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition ${
                scrapped
                  ? "text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  : "text-[var(--muted)] hover:bg-[var(--subtle)] hover:text-[var(--fg)]"
              }`}
            >
              <Bookmark
                className={`size-3.5 ${scrapped ? "fill-current" : ""}`}
                strokeWidth={1.75}
              />
            </button>
            {isAdmin && (
              <button
                onClick={() => onEdit(place)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-[var(--muted)] transition hover:bg-[var(--subtle)] hover:text-[var(--fg)]"
                aria-label="편집"
                title="편집"
              >
                <Pencil className="size-3.5" strokeWidth={1.75} />
                편집
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[var(--subtle)] hover:text-[var(--fg)]"
              aria-label="닫기"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {images.length > 0 ? (
            <div className="relative">
              <div
                ref={carouselRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.clientWidth > 0) {
                    setActiveIdx(Math.round(el.scrollLeft / el.clientWidth));
                  }
                }}
                className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto"
                style={{ scrollbarWidth: "none" }}
              >
                {images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt={`${place.name} ${i + 1}`}
                    referrerPolicy="no-referrer"
                    className="size-full shrink-0 snap-center object-cover"
                    style={{ width: "100%" }}
                  />
                ))}
              </div>
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => scrollTo(activeIdx - 1)}
                    aria-label="이전"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur transition hover:bg-black/60"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => scrollTo(activeIdx + 1)}
                    aria-label="다음"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur transition hover:bg-black/60"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => scrollTo(i)}
                        aria-label={`사진 ${i + 1}`}
                        className={`size-1.5 rounded-full transition ${
                          i === activeIdx ? "bg-white w-4" : "bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="aspect-[4/3] bg-[var(--subtle)]" />
          )}

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--subtle)] px-2 py-1 text-[var(--fg)]/80">
                <Icon className="size-3" strokeWidth={2} />
                {place.category}
              </span>
              {place.naverCategory && (
                <span className="text-[var(--muted)]">{place.naverCategory}</span>
              )}
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-0.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]"
                >
                  <MapPin className="size-2.5" strokeWidth={2} />
                  {t}
                </span>
              ))}
              {rating && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-100/60 px-2 py-1 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                  <Star className="size-3 fill-current" strokeWidth={0} />
                  <span className="tabular-nums">{rating}</span>
                  {place.reviewCount != null && (
                    <span className="opacity-70">· {place.reviewCount.toLocaleString()}</span>
                  )}
                </span>
              )}
            </div>

            {place.description && (
              <p className="whitespace-pre-wrap rounded-lg border bg-[var(--subtle)]/50 px-3 py-2.5 text-sm leading-relaxed text-[var(--fg)]/85">
                {place.description}
              </p>
            )}

            <dl className="space-y-2 text-sm">
              {place.address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" strokeWidth={1.5} />
                  <span className="text-[var(--fg)]/85">{place.address}</span>
                </div>
              )}
              {place.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" strokeWidth={1.5} />
                  <a
                    href={`tel:${place.phone.replace(/[^0-9+]/g, "")}`}
                    className="font-mono text-sm text-[var(--fg)]/85 hover:underline"
                  >
                    {place.phone}
                  </a>
                </div>
              )}
              {place.businessHours && (
                <div className="flex items-start gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" strokeWidth={1.5} />
                  <span className="whitespace-pre-wrap text-[var(--fg)]/85">{place.businessHours}</span>
                </div>
              )}
            </dl>

            <section className="border-t pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                  댓글 {sortedComments.length > 0 && `· ${sortedComments.length}`}
                </h3>
                <button
                  onClick={() => onToggleLike(place.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                    liked
                      ? "border-red-400/60 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                      : "text-[var(--muted)] hover:border-red-300/60 hover:text-red-500"
                  }`}
                  aria-label={liked ? "좋아요 취소" : "좋아요"}
                >
                  <Heart
                    className={`size-3.5 ${liked ? "fill-current" : ""}`}
                    strokeWidth={1.75}
                  />
                  <span className="tabular-nums">{likeCount}</span>
                </button>
              </div>

              {sortedComments.length === 0 ? (
                <p className="rounded-lg border border-dashed py-4 text-center text-xs text-[var(--muted)]">
                  첫 댓글을 남겨주세요.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sortedComments.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-lg border bg-[var(--subtle)]/40 px-3 py-2 text-sm"
                    >
                      <div className="mb-0.5 flex items-center justify-between text-[11px] text-[var(--muted)]">
                        <span>
                          <span className="font-mono text-[var(--fg)]/70">@{c.author}</span>{" "}
                          · {formatRelativeKst(c.createdAt)}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemove(c.id)}
                            disabled={removingId === c.id}
                            className="text-[var(--muted)] transition hover:text-red-600 disabled:opacity-50"
                            aria-label="삭제"
                            title="삭제"
                          >
                            {removingId === c.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3" strokeWidth={1.75} />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-[var(--fg)]/85">{c.text}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 space-y-1.5">
                <div className="flex items-end gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="댓글을 남겨주세요"
                    rows={2}
                    maxLength={500}
                    disabled={posting}
                    className="flex-1 resize-none rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
                  />
                  <button
                    onClick={handlePost}
                    disabled={posting || !commentText.trim()}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--fg)] p-2 text-[var(--bg)] transition hover:opacity-90 disabled:opacity-50"
                    aria-label="댓글 작성"
                  >
                    {posting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
                {postError && (
                  <p className="text-[11px] text-red-600 dark:text-red-300">{postError}</p>
                )}
              </div>
            </section>
          </div>
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t bg-[var(--card)] p-3">
          <a
            href={dirUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Navigation className="size-3.5" strokeWidth={1.75} />
            길찾기
          </a>
          <a
            href={place.naverMapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--fg)] py-2 text-sm text-[var(--bg)] transition hover:opacity-90"
          >
            Naver지도
            <ExternalLink className="size-3.5" strokeWidth={1.75} />
          </a>
        </footer>
      </div>
    </div>
  );
}
