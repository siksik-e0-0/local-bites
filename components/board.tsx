"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Category, Place } from "@/lib/types";
import { AddDialog } from "./add-dialog";
import { CategoryFilter, type FilterValue } from "./category-filter";
import { EmptyState } from "./empty-state";
import { PlaceCard } from "./place-card";

const NICK_KEY = "lb:nickname";
const DEFAULT_NICK = "guest";
const REPO_EDIT_URL =
  process.env.NEXT_PUBLIC_REPO_EDIT_URL ??
  "https://github.com/siksik-e0-0/local-bites/edit/main/share_link";

function formatKst(iso: string): string {
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return fmt.format(d).replace(/\./g, "").replace(/(\d{4}) (\d{2}) (\d{2})/, "$1.$2.$3");
  } catch {
    return iso;
  }
}

export function Board({
  initialPlaces,
  generatedAt,
}: {
  initialPlaces: Place[];
  generatedAt: string;
}) {
  const [filter, setFilter] = useState<FilterValue>("전체");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nickname, setNickname] = useState<string>(DEFAULT_NICK);
  const [editingNick, setEditingNick] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(NICK_KEY) : null;
    if (saved) setNickname(saved);
  }, []);

  function saveNick(v: string) {
    const clean = v.trim().slice(0, 24) || DEFAULT_NICK;
    setNickname(clean);
    try {
      window.localStorage.setItem(NICK_KEY, clean);
    } catch {
      // ignore
    }
  }

  const counts: Record<FilterValue, number> = useMemo(() => {
    const base: Record<FilterValue, number> = { 전체: initialPlaces.length, 식당: 0, 카페: 0, 기타: 0 };
    for (const p of initialPlaces) {
      base[p.category as Category]++;
    }
    return base;
  }, [initialPlaces]);

  const visible = useMemo(() => {
    if (filter === "전체") return initialPlaces;
    return initialPlaces.filter((p) => p.category === filter);
  }, [filter, initialPlaces]);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-24 pt-12 sm:px-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
            Local Bites · 가족여행
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            맛집 정보판
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            함께 정해요 — 후보 <span className="tabular-nums text-[var(--fg)]/80">{initialPlaces.length}</span>곳
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {editingNick ? (
            <input
              autoFocus
              defaultValue={nickname}
              onBlur={(e) => {
                saveNick(e.currentTarget.value);
                setEditingNick(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveNick((e.target as HTMLInputElement).value);
                  setEditingNick(false);
                } else if (e.key === "Escape") {
                  setEditingNick(false);
                }
              }}
              className="w-32 rounded-full border bg-[var(--bg)] px-3 py-1 font-mono text-xs outline-none focus:border-[var(--fg)]/50"
            />
          ) : (
            <button
              onClick={() => setEditingNick(true)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)]"
              title="닉네임 변경"
            >
              <span className="text-[var(--fg)]/50">@</span>
              {nickname}
            </button>
          )}
        </div>
      </header>

      <div className="sticky top-0 z-20 -mx-5 mt-10 flex flex-col gap-3 bg-[var(--bg)]/85 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <CategoryFilter value={filter} onChange={setFilter} counts={counts} />
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--bg)] transition hover:opacity-90"
        >
          <Plus className="size-4" strokeWidth={2} />
          후보 추가
        </button>
      </div>

      <section className="mt-6">
        {visible.length === 0 ? (
          <EmptyState onAdd={() => setDialogOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((p, i) => (
              <PlaceCard key={p.id || p.shortUrl} place={p} index={i} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-16 flex items-center justify-between border-t pt-5 text-xs text-[var(--muted)]">
        <span>
          마지막 갱신 · <span className="font-mono">{formatKst(generatedAt)}</span> KST
        </span>
        <button
          onClick={() => typeof window !== "undefined" && window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-[var(--subtle)] hover:text-[var(--fg)]"
        >
          <RefreshCw className="size-3" strokeWidth={1.75} />
          새로고침
        </button>
      </footer>

      <AddDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        repoEditUrl={REPO_EDIT_URL}
      />
    </div>
  );
}
