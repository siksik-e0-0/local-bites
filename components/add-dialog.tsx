"use client";

import { Check, Copy, ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/types";

type Tab = "single" | "bulk";
const CATS: (Category | null)[] = [null, "식당", "카페", "기타"];

export function AddDialog({
  open,
  onClose,
  repoEditUrl,
}: {
  open: boolean;
  onClose: () => void;
  repoEditUrl?: string;
}) {
  const [tab, setTab] = useState<Tab>("single");
  const [url, setUrl] = useState("");
  const [bulk, setBulk] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setCopied(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const produced = (() => {
    if (tab === "single") {
      if (!url.trim()) return "";
      return cat ? `${url.trim()} | ${cat}` : url.trim();
    }
    return bulk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => (cat && !l.includes("|") ? `${l} | ${cat}` : l))
      .join("\n");
  })();

  async function handleCopy() {
    if (!produced) return;
    try {
      await navigator.clipboard.writeText(produced);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 무시
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
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border bg-[var(--card)] shadow-2xl"
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

        <div className="px-5 pt-4">
          <div className="inline-flex items-center gap-1 rounded-full border bg-[var(--subtle)] p-1 text-xs">
            <button
              onClick={() => setTab("single")}
              className={`rounded-full px-3 py-1 transition ${
                tab === "single" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--muted)]"
              }`}
            >
              단일
            </button>
            <button
              onClick={() => setTab("bulk")}
              className={`rounded-full px-3 py-1 transition ${
                tab === "bulk" ? "bg-[var(--fg)] text-[var(--bg)]" : "text-[var(--muted)]"
              }`}
            >
              일괄
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {tab === "single" ? (
            <div>
              <label className="mb-1.5 block text-xs text-[var(--muted)]">Naver 지도 단축 URL</label>
              <input
                ref={inputRef}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://naver.me/XXXXXXXX"
                className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--fg)]/50"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs text-[var(--muted)]">
                여러 URL — 한 줄에 하나씩
              </label>
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={5}
                placeholder={"https://naver.me/AAAAAAAA\nhttps://naver.me/BBBBBBBB"}
                className="w-full resize-none rounded-lg border bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--fg)]/50"
              />
            </div>
          )}

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
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
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

          {produced && (
            <div className="rounded-lg border bg-[var(--subtle)] p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  share_link 에 추가할 내용
                </span>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md border bg-[var(--card)] px-2 py-0.5 text-xs transition hover:border-[var(--fg)]/40"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[var(--fg)]/80">
                {produced}
              </pre>
            </div>
          )}

          <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-[var(--muted)]">
            위 내용을 GitHub 저장소의 <code className="font-mono text-[var(--fg)]/80">share_link</code> 파일 끝에 추가하고
            push 하면 Vercel 이 자동으로 다시 빌드해 카드가 추가됩니다.
          </div>

          {repoEditUrl && (
            <a
              href={repoEditUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--fg)] py-2 text-sm text-[var(--bg)] transition hover:opacity-90"
            >
              GitHub 에서 share_link 편집
              <ExternalLink className="size-3.5" strokeWidth={1.75} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
