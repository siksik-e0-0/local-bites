"use client";

import { Check, Loader2, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Category, MenuItem } from "@/lib/types";
import { LocationPicker } from "./location-picker";
import { MenuEditor } from "./menu-editor";

const CATS: (Category | null)[] = [null, "식당", "카페", "기타"];

type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "ok"; msg: string; added: boolean }
  | { state: "error"; msg: string };

type PreviewStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; parserFailed: boolean }
  | { state: "error"; msg: string };

interface PreviewData {
  placeId: string | null;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  heroImageUrl: string | null;
  description: string;
  businessHours: string;
  menu: MenuItem[];
}

const EMPTY_PREVIEW: PreviewData = {
  placeId: null,
  name: "",
  address: "",
  lat: null,
  lng: null,
  heroImageUrl: null,
  description: "",
  businessHours: "",
  menu: [],
};

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({ state: "idle" });
  const [preview, setPreview] = useState<PreviewData>(EMPTY_PREVIEW);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewedUrlRef = useRef<string>("");

  useEffect(() => {
    if (open) {
      setSaveStatus({ state: "idle" });
      setPreviewStatus({ state: "idle" });
      setPreview(EMPTY_PREVIEW);
      previewedUrlRef.current = "";
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

  function urlValid(u: string): boolean {
    return /^https:\/\/(naver\.me|map\.naver\.com|m\.place\.naver\.com)\//i.test(u);
  }

  async function runPreview() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!urlValid(trimmed)) {
      setPreviewStatus({ state: "error", msg: "Naver 지도 단축 URL 만 가능합니다." });
      return;
    }
    if (trimmed === previewedUrlRef.current) return;
    previewedUrlRef.current = trimmed;
    setPreviewStatus({ state: "loading" });
    setPreview(EMPTY_PREVIEW);
    try {
      const res = await fetch("/api/places/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        placeId?: string;
        name?: string | null;
        category?: Category | null;
        address?: string | null;
        lat?: number | null;
        lng?: number | null;
        heroImageUrl?: string | null;
        parserFailed?: boolean;
        error?: string;
      };
      if (!data.ok) {
        setPreviewStatus({ state: "error", msg: data.error || "프리뷰 실패" });
        return;
      }
      setPreview((prev) => ({
        placeId: data.placeId ?? null,
        name: data.name ?? "",
        address: data.address ?? "",
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        heroImageUrl: data.heroImageUrl ?? null,
        description: prev.description,
        businessHours: prev.businessHours,
        menu: prev.menu,
      }));
      if (data.category && !cat) setCat(data.category);
      setPreviewStatus({ state: "ready", parserFailed: !!data.parserFailed });
    } catch (err) {
      setPreviewStatus({
        state: "error",
        msg: `네트워크 오류: ${(err as Error).message}`,
      });
    }
  }

  async function save() {
    const trimmed = url.trim();
    if (!trimmed) {
      setSaveStatus({ state: "error", msg: "URL 을 입력해 주세요." });
      return;
    }
    if (!urlValid(trimmed)) {
      setSaveStatus({ state: "error", msg: "Naver 지도 단축 URL 만 가능합니다." });
      return;
    }
    setSaveStatus({ state: "saving" });
    try {
      const payload: Record<string, unknown> = { url: trimmed, category: cat };
      if (preview.placeId) payload.placeId = preview.placeId;
      const name = preview.name.trim();
      if (name) payload.name = name;
      const addr = preview.address.trim();
      if (addr) payload.address = addr;
      if (preview.lat != null) payload.lat = preview.lat;
      if (preview.lng != null) payload.lng = preview.lng;
      const desc = preview.description.trim();
      if (desc) payload.description = desc;
      const bh = preview.businessHours.trim();
      if (bh) payload.businessHours = bh;
      const cleanedMenu = preview.menu
        .map((m) => ({ ...m, name: m.name.trim(), price: m.price?.trim() || null }))
        .filter((m) => m.name);
      if (cleanedMenu.length > 0) payload.menu = cleanedMenu;

      const res = await fetch("/api/places/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok: boolean;
        added?: boolean;
        message?: string;
        error?: string;
      };
      if (!data.ok) {
        setSaveStatus({ state: "error", msg: data.error || "저장 실패" });
        return;
      }
      setSaveStatus({
        state: "ok",
        msg: data.message || "추가되었습니다.",
        added: !!data.added,
      });
      onAdded?.(trimmed);
      setUrl("");
      setCat(null);
      setPreview(EMPTY_PREVIEW);
      setPreviewStatus({ state: "idle" });
      previewedUrlRef.current = "";
    } catch (err) {
      setSaveStatus({
        state: "error",
        msg: `네트워크 오류: ${(err as Error).message}`,
      });
    }
  }

  if (!open) return null;

  const saving = saveStatus.state === "saving";
  const loadingPreview = previewStatus.state === "loading";
  const showPreviewFields = previewStatus.state === "ready";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-[var(--card)] px-5 py-3">
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
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (saveStatus.state === "error") setSaveStatus({ state: "idle" });
                  if (previewStatus.state === "error") setPreviewStatus({ state: "idle" });
                  if (e.target.value.trim() !== previewedUrlRef.current) {
                    previewedUrlRef.current = "";
                  }
                }}
                onBlur={() => {
                  if (url.trim() && urlValid(url.trim()) && previewStatus.state === "idle") {
                    void runPreview();
                  }
                }}
                placeholder="https://naver.me/XXXXXXXX"
                disabled={saving}
                className="flex-1 rounded-lg border bg-[var(--bg)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={runPreview}
                disabled={saving || loadingPreview || !url.trim() || !urlValid(url.trim())}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 text-xs text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)] disabled:opacity-50"
                title="URL 정보 가져오기"
              >
                {loadingPreview ? <Loader2 className="size-3 animate-spin" /> : "조회"}
              </button>
            </div>
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
                    disabled={saving}
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

          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">설명 / 메모 (선택)</label>
            <textarea
              value={preview.description}
              onChange={(e) => setPreview((p) => ({ ...p, description: e.target.value }))}
              disabled={saving}
              rows={3}
              maxLength={500}
              placeholder="추천 이유, 주의사항, 메뉴 추천 등"
              className="w-full resize-y rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
            />
            <p className="mt-1 text-right text-[10px] text-[var(--muted)]">
              {preview.description.length}/500
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">영업시간 (선택)</label>
            <textarea
              value={preview.businessHours}
              onChange={(e) => setPreview((p) => ({ ...p, businessHours: e.target.value }))}
              disabled={saving}
              rows={2}
              maxLength={500}
              placeholder="예) 매일 11:00 - 21:00 / 매주 화 휴무"
              className="w-full resize-y rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs text-[var(--muted)]">메뉴 (선택)</label>
              <span className="text-[10px] text-[var(--muted)]">{preview.menu.length}/30</span>
            </div>
            <MenuEditor
              items={preview.menu}
              onChange={(menu) => setPreview((p) => ({ ...p, menu }))}
              disabled={saving}
            />
          </div>

          {previewStatus.state === "error" && (
            <div className="rounded-lg border border-orange-300/50 bg-orange-50/60 px-3 py-2 text-xs text-orange-800 dark:border-orange-700/50 dark:bg-orange-950/40 dark:text-orange-200">
              {previewStatus.msg}
            </div>
          )}

          {showPreviewFields && (
            <>
              {previewStatus.state === "ready" && previewStatus.parserFailed && (
                <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
                  Naver 자동 정보 추출 실패 — 아래에서 직접 입력해 주세요.
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs text-[var(--muted)]">이름 (선택)</label>
                <input
                  value={preview.name}
                  onChange={(e) => setPreview((p) => ({ ...p, name: e.target.value }))}
                  placeholder="비워두면 빌드 후 자동 추출 시도"
                  disabled={saving}
                  className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-[var(--muted)]">주소 (선택)</label>
                <input
                  value={preview.address}
                  onChange={(e) => setPreview((p) => ({ ...p, address: e.target.value }))}
                  placeholder="예: 제주 제주시 노형로 123"
                  disabled={saving}
                  className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <MapPin className="size-3" strokeWidth={1.75} />
                  좌표 (선택)
                </label>
                <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                  <input
                    value={preview.lat ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setPreview((p) => ({
                        ...p,
                        lat: v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : p.lat,
                      }));
                    }}
                    placeholder="lat"
                    disabled={saving}
                    inputMode="decimal"
                    className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
                  />
                  <input
                    value={preview.lng ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setPreview((p) => ({
                        ...p,
                        lng: v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : p.lng,
                      }));
                    }}
                    placeholder="lng"
                    disabled={saving}
                    inputMode="decimal"
                    className="w-full rounded-lg border bg-[var(--bg)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
                  />
                </div>
                <LocationPicker
                  lat={preview.lat}
                  lng={preview.lng}
                  onCoordsChange={(lat, lng) => setPreview((p) => ({ ...p, lat, lng }))}
                  onGeocodeRequest={() => preview.address.trim()}
                  geocodeAddress={preview.address}
                  disabled={saving}
                />
              </div>
            </>
          )}

          {saveStatus.state === "error" && (
            <div className="rounded-lg border border-red-300/50 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-700/50 dark:bg-red-950/40 dark:text-red-200">
              {saveStatus.msg}
            </div>
          )}
          {saveStatus.state === "ok" && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)]">
              <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
              <span>{saveStatus.msg}</span>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--fg)] py-2.5 text-sm font-medium text-[var(--bg)] transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                저장 중…
              </>
            ) : (
              "저장"
            )}
          </button>

          <p className="text-center text-[10px] leading-relaxed text-[var(--muted)]">
            URL 만 저장해도 가능 — 주소/좌표 미리 입력하면 빌드 후 즉시 지도에 표시됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
