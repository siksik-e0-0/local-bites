"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function NicknameOnboarding({
  open,
  onSubmit,
}: {
  open: boolean;
  onSubmit: (nickname: string) => void;
}) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const v = val.trim();
    onSubmit(v || "guest");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border bg-[var(--card)] shadow-2xl">
        <div className="space-y-4 px-6 py-7 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles className="size-5" strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight">함께 정해요</h2>
            <p className="text-sm text-[var(--muted)]">
              가족여행 맛집을 함께 고를 거예요.
              <br />
              어떻게 부를까요?
            </p>
          </div>

          <input
            ref={inputRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="이름 또는 닉네임"
            maxLength={24}
            className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2.5 text-center text-sm outline-none focus:border-[var(--fg)]/50"
          />

          <div className="space-y-2">
            <button
              onClick={submit}
              className="w-full rounded-lg bg-[var(--fg)] py-2.5 text-sm font-medium text-[var(--bg)] transition hover:opacity-90"
            >
              시작하기
            </button>
            <button
              onClick={() => onSubmit("guest")}
              className="w-full rounded-lg py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--fg)]"
            >
              건너뛰기
            </button>
          </div>

          <p className="text-[10px] leading-relaxed text-[var(--muted)]">
            <span className="font-mono">admin</span> 으로 입력하면 관리자 모드가 활성화됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
