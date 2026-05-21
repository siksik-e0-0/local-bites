"use client";

import { Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { verifyAdminPassword } from "@/lib/admin-client";

type Status =
  | { state: "idle" }
  | { state: "verifying" }
  | { state: "error"; msg: string };

export function AdminDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setPw("");
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

  if (!open) return null;

  async function submit() {
    if (!pw) {
      setStatus({ state: "error", msg: "비밀번호를 입력해 주세요." });
      return;
    }
    setStatus({ state: "verifying" });
    const res = await verifyAdminPassword(pw);
    if (!res.ok) {
      setStatus({ state: "error", msg: res.error ?? "인증 실패" });
      return;
    }
    onSuccess(pw);
    setPw("");
    setStatus({ state: "idle" });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--accent)]" strokeWidth={1.75} />
            <h2 className="text-sm font-medium">관리자 인증</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted)] transition hover:bg-[var(--subtle)] hover:text-[var(--fg)]"
            aria-label="닫기"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            관리자 비밀번호를 입력하면 카드 편집과 삭제가 가능해집니다.
          </p>

          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">비밀번호</label>
            <input
              ref={inputRef}
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                if (status.state === "error") setStatus({ state: "idle" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              disabled={status.state === "verifying"}
              className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
            />
          </div>

          {status.state === "error" && (
            <div className="rounded-lg border border-red-300/50 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-700/50 dark:bg-red-950/40 dark:text-red-200">
              {status.msg}
            </div>
          )}

          <button
            onClick={submit}
            disabled={status.state === "verifying"}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--fg)] py-2.5 text-sm font-medium text-[var(--bg)] transition hover:opacity-90 disabled:opacity-60"
          >
            {status.state === "verifying" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                확인 중…
              </>
            ) : (
              "확인"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
