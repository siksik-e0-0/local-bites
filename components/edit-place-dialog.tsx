"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Category, Place, PlaceEditPayload } from "@/lib/types";

const CATS: Category[] = ["식당", "카페", "기타"];

type Status =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "ok"; msg: string }
  | { state: "error"; msg: string };

export function EditPlaceDialog({
  place,
  adminToken,
  onClose,
  onSaved,
}: {
  place: Place | null;
  adminToken: string | null;
  onClose: () => void;
  onSaved: (patch: PlaceEditPayload) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("식당");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!place) return;
    setName(place.name);
    setCategory(place.category);
    setTags(place.tags ?? []);
    setTagInput("");
    setDescription(place.description ?? "");
    setStatus({ state: "idle" });
    setTimeout(() => nameRef.current?.focus(), 40);
  }, [place]);

  useEffect(() => {
    if (!place) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [place, onClose]);

  if (!place) return null;

  function addTagFromInput() {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setTagInput("");
      return;
    }
    if (tags.length >= 12) return;
    setTags([...tags, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  async function save() {
    const current = place;
    if (!current) return;
    if (!adminToken) {
      setStatus({ state: "error", msg: "관리자 토큰이 없습니다. 다시 로그인해 주세요." });
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus({ state: "error", msg: "이름은 비울 수 없습니다." });
      return;
    }
    const patch: PlaceEditPayload = {
      name: trimmedName,
      category,
      tags,
      description: description.trim() ? description.trim() : null,
    };
    setStatus({ state: "saving" });
    try {
      const res = await fetch("/api/places/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ id: current.id, patch }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; message?: string };
      if (!data.ok) {
        setStatus({ state: "error", msg: data.error ?? "저장 실패" });
        return;
      }
      onSaved(patch);
      setStatus({ state: "ok", msg: data.message ?? "저장되었습니다." });
    } catch (err) {
      setStatus({ state: "error", msg: `네트워크 오류: ${(err as Error).message}` });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-medium">편집 · {place.name}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted)] transition hover:bg-[var(--subtle)] hover:text-[var(--fg)]"
            aria-label="닫기"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">이름</label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status.state === "saving"}
              maxLength={80}
              className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">카테고리</label>
            <div className="inline-flex flex-wrap gap-1.5">
              {CATS.map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    disabled={status.state === "saving"}
                    className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60 ${
                      active
                        ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]"
                        : "text-[var(--muted)] hover:border-[var(--fg)]/40 hover:text-[var(--fg)]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">태그</label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]"
                >
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    disabled={status.state === "saving"}
                    aria-label={`${t} 제거`}
                    className="rounded-full text-[var(--accent)]/70 transition hover:text-[var(--accent)]"
                  >
                    <X className="size-3" strokeWidth={2} />
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-[11px] text-[var(--muted)]">아직 태그가 없습니다.</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTagFromInput();
                  }
                }}
                placeholder="태그 입력 후 Enter"
                disabled={status.state === "saving" || tags.length >= 12}
                className="flex-1 rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
              />
              <button
                onClick={addTagFromInput}
                disabled={status.state === "saving" || !tagInput.trim() || tags.length >= 12}
                className="rounded-lg border px-3 text-xs transition hover:border-[var(--fg)]/40 disabled:opacity-50"
              >
                추가
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[var(--muted)]">최대 12개, Enter 또는 쉼표로 추가</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">설명 / 메모</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={status.state === "saving"}
              rows={4}
              maxLength={500}
              placeholder="추천 이유, 주의사항, 메뉴 추천 등"
              className="w-full resize-y rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
            />
            <p className="mt-1 text-right text-[10px] text-[var(--muted)]">{description.length}/500</p>
          </div>

          {status.state === "error" && (
            <div className="rounded-lg border border-red-300/50 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-700/50 dark:bg-red-950/40 dark:text-red-200">
              {status.msg}
            </div>
          )}
          {status.state === "ok" && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)]">
              <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
              <span>{status.msg}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={status.state === "saving"}
              className="flex-1 rounded-lg border py-2.5 text-sm transition hover:border-[var(--fg)]/40 disabled:opacity-60"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={status.state === "saving"}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--fg)] py-2.5 text-sm font-medium text-[var(--bg)] transition hover:opacity-90 disabled:opacity-60"
            >
              {status.state === "saving" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  저장 중…
                </>
              ) : (
                "저장"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
