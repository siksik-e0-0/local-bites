"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/types";

const CATS: (Category | null)[] = [null, "식당", "카페", "기타"];

type Status =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "ok"; msg: string; added: boolean }
  | { state: "error"; msg: string };

export function AddDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded?: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setStatus({ state: "idle" });
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function save() {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus({ state: "error", msg: "URL 을 입력해 주세요." });
      return;
    }
    if (!/^https:\/\/(naver\.me|map\.naver\.com|m\.place\.naver\.com)\//i.test(trimmed)) {
      setStatus({ state: "error", msg: "Naver 지도 단축 URL 만 가능합니다." });
      return;
    }
    setStatus({ state: "saving" });
    try {
      const res = await fetch("/api/places/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, category: cat }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        added?: boolean;
        message?: string;
        error?: string;
      };
      if (!data.ok) {
        setStatus({ state: "error", msg: data.error || "저장 실패" });
        return;
      }
      setStatus({
        state: "ok",
        msg: data.message || "추가되었습니다.",
        added: !!data.added,
      });
      onAdded?.(trimmed);
      setUrl("");
      setCat(null);
    } catch (err) {
      setStatus({
        state: "error",
        msg: `네트워크 오류: ${(err as Error).message}`,
      });
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-medium">후보 추가</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted)] transition hover:bg-[var(--subtle)] hover:text-[var(--fg)]"
            aria-label="닫기"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">
              Naver 지도 단축 URL
            </label>
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (status.state === "error") setStatus({ state: "idle" });
              }}
              placeholder="https://naver.me/XXXXXXXX"
              disabled={status.state === "saving"}
              className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">카테고리 (선택)</label>
            <div className="inline-flex flex-wrap gap-1.5">
              {CATS.map((c) => {
                const active = cat === c;
                const label = c ?? "자동";
                return (
                  <button
                    key={label}
                    onClick={() => setCat(c)}
                    disabled={status.state === "saving"}
                    className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60 ${
                      active
                        ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]"
                        : "text-[var(--muted)] hover:border-[var(--fg)]/40 hover:text-[var(--fg)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
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

          <button
            onClick={save}
            disabled={status.state === "saving"}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--fg)] py-2.5 text-sm font-medium text-[var(--bg)] transition hover:opacity-90 disabled:opacity-60"
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

          <p className="text-center text-[10px] leading-relaxed text-[var(--muted)]">
            저장하면 자동으로 GitHub <code className="font-mono">share_link</code> 에 추가되고
            잠시 후 새 카드가 나타납니다.
          </p>
        </div>
      </div>
    </div>
  );
}
