"use client";

import { LogOut, Plus, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAdminToken, setAdminToken } from "@/lib/admin-client";
import type { Category, Place, PlaceEditPayload } from "@/lib/types";
import { AddDialog } from "./add-dialog";
import { AdminDialog } from "./admin-dialog";
import { CategoryFilter, type FilterValue } from "./category-filter";
import { EditPlaceDialog } from "./edit-place-dialog";
import { EmptyState } from "./empty-state";
import { NicknameOnboarding } from "./nickname-onboarding";
import { PlaceCard } from "./place-card";
import { PlaceDetail } from "./place-detail";
import { PlaceMap } from "./place-map";

const NICK_KEY = "lb:nickname";

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
  const [places, setPlaces] = useState<Place[]>(initialPlaces);
  const [filter, setFilter] = useState<FilterValue>("전체");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [editing, setEditing] = useState<Place | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [editingNick, setEditingNick] = useState(false);
  const [adminToken, setAdminTokenState] = useState<string | null>(null);

  useEffect(() => {
    setPlaces(initialPlaces);
  }, [initialPlaces]);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(NICK_KEY) : null;
    if (saved) {
      setNickname(saved);
    } else {
      setNeedsOnboarding(true);
    }
    setAdminTokenState(getAdminToken());
  }, []);

  function saveNick(v: string) {
    const clean = v.trim().slice(0, 24) || "guest";
    setNickname(clean);
    try {
      window.localStorage.setItem(NICK_KEY, clean);
    } catch {
      // ignore
    }
  }

  function handleAdminSuccess(token: string) {
    setAdminToken(token);
    setAdminTokenState(token);
    setAdminDialogOpen(false);
  }

  function logoutAdmin() {
    setAdminToken(null);
    setAdminTokenState(null);
  }

  function applyLocalEdit(id: string, patch: PlaceEditPayload) {
    const applyTo = <T extends Place>(p: T): T => {
      const nextImages = patch.images ?? p.images;
      const nextHero = patch.images ? (patch.images[0] ?? null) : p.heroImageUrl;
      return {
        ...p,
        name: patch.name ?? p.name,
        category: patch.category ?? p.category,
        tags: patch.tags ?? p.tags,
        description: patch.description !== undefined ? patch.description : p.description ?? null,
        images: nextImages,
        heroImageUrl: nextHero,
      };
    };
    setPlaces((prev) => prev.map((p) => (p.id === id ? applyTo(p) : p)));
    setSelected((cur) => (cur && cur.id === id ? applyTo(cur) : cur));
  }

  function applyLocalDelete(id: string) {
    setPlaces((prev) => prev.filter((p) => p.id !== id));
    setSelected((cur) => (cur && cur.id === id ? null : cur));
    setEditing((cur) => (cur && cur.id === id ? null : cur));
  }

  const isAdmin = adminToken !== null;

  const counts: Record<FilterValue, number> = useMemo(() => {
    const base: Record<FilterValue, number> = {
      전체: places.length,
      식당: 0,
      카페: 0,
      기타: 0,
    };
    for (const p of places) base[p.category as Category]++;
    return base;
  }, [places]);

  const visible = useMemo(() => {
    if (filter === "전체") return places;
    return places.filter((p) => p.category === filter);
  }, [filter, places]);

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
            함께 정해요 — 후보{" "}
            <span className="tabular-nums text-[var(--fg)]/80">{places.length}</span>곳
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {isAdmin ? (
            <button
              onClick={logoutAdmin}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 py-1 font-mono text-[var(--accent)] transition hover:opacity-90"
              title="관리자 모드 종료"
            >
              <ShieldCheck className="size-3" strokeWidth={2} />
              관리자
              <LogOut className="size-3 opacity-70" strokeWidth={2} />
            </button>
          ) : (
            <button
              onClick={() => setAdminDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)]"
              title="관리자 로그인"
            >
              <ShieldOff className="size-3" strokeWidth={2} />
              관리자
            </button>
          )}

          {nickname && (
            editingNick ? (
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
            )
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
              <PlaceCard
                key={p.id || p.shortUrl}
                place={p}
                index={i}
                isAdmin={isAdmin}
                adminToken={adminToken}
                onSelect={setSelected}
                onEdit={setEditing}
                onDeleted={applyLocalDelete}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-16">
        <PlaceMap places={visible} onSelect={setSelected} />
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

      <AddDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <PlaceDetail
        place={selected}
        isAdmin={isAdmin}
        onClose={() => setSelected(null)}
        onEdit={(p) => setEditing(p)}
      />
      <EditPlaceDialog
        place={editing}
        adminToken={adminToken}
        onClose={() => setEditing(null)}
        onSaved={(patch) => {
          if (editing) applyLocalEdit(editing.id, patch);
        }}
      />
      <AdminDialog
        open={adminDialogOpen}
        onClose={() => setAdminDialogOpen(false)}
        onSuccess={handleAdminSuccess}
      />
      <NicknameOnboarding
        open={needsOnboarding}
        onSubmit={(v) => {
          saveNick(v);
          setNeedsOnboarding(false);
        }}
      />
    </div>
  );
}
