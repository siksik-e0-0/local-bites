"use client";

import { Check, ImagePlus, Link2, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Category, Place, PlaceEditPayload } from "@/lib/types";

const MAX_IMAGE_WIDTH = 1280;
const MAX_IMAGES = 12;
const WEBP_QUALITY = 0.82;

async function compressImageToWebp(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일이 아닙니다.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("이미지 디코드 실패"));
    im.src = dataUrl;
  });
  const ratio = img.width > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / img.width : 1;
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 컨텍스트 생성 실패");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/webp", WEBP_QUALITY);
  if (!out.startsWith("data:image/webp")) {
    return canvas.toDataURL("image/jpeg", 0.85);
  }
  return out;
}

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
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState("");
  const [coordsInput, setCoordsInput] = useState("");
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const nameRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!place) return;
    setName(place.name);
    setCategory(place.category);
    setTags(place.tags ?? []);
    setTagInput("");
    setDescription(place.description ?? "");
    setImages(place.images ?? []);
    setImageUrlInput("");
    setImageError(null);
    setUploading(false);
    setAddress(place.address ?? "");
    if (place.lat != null && place.lng != null) {
      setCoordsInput(`${place.lat}, ${place.lng}`);
    } else {
      setCoordsInput("");
    }
    setCoordsError(null);
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

  function removeImage(url: string) {
    setImages(images.filter((x) => x !== url));
  }

  function addImageUrl() {
    const url = imageUrlInput.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/uploads\/)/i.test(url)) {
      setImageError("https:// 또는 /uploads/ 로 시작하는 URL 만 가능합니다.");
      return;
    }
    if (images.includes(url)) {
      setImageUrlInput("");
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setImageError(`최대 ${MAX_IMAGES}장까지 가능합니다.`);
      return;
    }
    setImages([...images, url]);
    setImageUrlInput("");
    setImageError(null);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!adminToken) {
      setImageError("관리자 토큰이 없습니다.");
      return;
    }
    const current = place;
    if (!current) return;
    setImageError(null);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (images.length + uploaded.length >= MAX_IMAGES) break;
        const dataUrl = await compressImageToWebp(file);
        const res = await fetch("/api/places/upload-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": adminToken,
          },
          body: JSON.stringify({ id: current.id, dataUrl }),
        });
        const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
        if (!data.ok || !data.url) {
          throw new Error(data.error ?? "업로드 실패");
        }
        uploaded.push(data.url);
      }
      setImages((prev) => Array.from(new Set([...prev, ...uploaded])));
    } catch (err) {
      setImageError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setImages(next);
  }

  function parseCoords(s: string): { lat: number | null; lng: number | null; error: string | null } {
    const t = s.trim();
    if (!t) return { lat: null, lng: null, error: null };
    const parts = t.split(/[\s,]+/).filter(Boolean).map(Number);
    if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
      return { lat: null, lng: null, error: "두 개의 숫자가 필요합니다 (예: 33.5384, 126.6657)." };
    }
    const [lat, lng] = parts;
    if (lat < -90 || lat > 90) return { lat: null, lng: null, error: "위도(lat)는 -90~90 범위여야 합니다." };
    if (lng < -180 || lng > 180) return { lat: null, lng: null, error: "경도(lng)는 -180~180 범위여야 합니다." };
    return { lat, lng, error: null };
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
    const coords = parseCoords(coordsInput);
    if (coords.error) {
      setStatus({ state: "error", msg: `좌표: ${coords.error}` });
      return;
    }
    const patch: PlaceEditPayload = {
      name: trimmedName,
      category,
      tags,
      description: description.trim() ? description.trim() : null,
      images,
      address: address.trim() ? address.trim() : null,
      lat: coords.lat,
      lng: coords.lng,
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

          <div className="space-y-2 rounded-lg border border-dashed bg-[var(--subtle)]/30 p-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[var(--fg)]/80">위치 정보</label>
              {place.naverMapUrl && (
                <a
                  href={place.naverMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  네이버 지도에서 열기 ↗
                </a>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] text-[var(--muted)]">주소</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={status.state === "saving"}
                maxLength={200}
                placeholder="제주특별자치도 ..."
                className="w-full rounded-md border bg-[var(--bg)] px-3 py-1.5 text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] text-[var(--muted)]">
                좌표 (lat, lng)
              </label>
              <input
                value={coordsInput}
                onChange={(e) => {
                  setCoordsInput(e.target.value);
                  if (coordsError) setCoordsError(null);
                }}
                onBlur={() => {
                  const c = parseCoords(coordsInput);
                  setCoordsError(c.error);
                }}
                disabled={status.state === "saving"}
                placeholder="33.5384, 126.6657"
                className="w-full rounded-md border bg-[var(--bg)] px-3 py-1.5 font-mono text-sm outline-none focus:border-[var(--fg)]/50 disabled:opacity-60"
              />
              {coordsError ? (
                <p className="mt-1 text-[10px] text-red-600 dark:text-red-300">{coordsError}</p>
              ) : (
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  네이버 지도에서 해당 위치 우클릭 → "이 위치 좌표 복사" 또는 URL 의 좌표를 붙여넣기
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs text-[var(--muted)]">사진</label>
              <span className="text-[10px] text-[var(--muted)]">
                {images.length}/{MAX_IMAGES} · 첫 번째 사진이 대표 이미지
              </span>
            </div>

            {images.length > 0 ? (
              <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((src, idx) => (
                  <div
                    key={src + idx}
                    className="group relative aspect-square overflow-hidden rounded-lg border bg-[var(--subtle)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`사진 ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute left-1 top-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
                        대표
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
                      <div className="flex gap-0.5">
                        <button
                          onClick={() => moveImage(idx, idx - 1)}
                          disabled={idx === 0 || status.state === "saving"}
                          aria-label="앞으로"
                          className="rounded bg-black/55 px-1 text-[10px] text-white transition hover:bg-black/80 disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          onClick={() => moveImage(idx, idx + 1)}
                          disabled={idx === images.length - 1 || status.state === "saving"}
                          aria-label="뒤로"
                          className="rounded bg-black/55 px-1 text-[10px] text-white transition hover:bg-black/80 disabled:opacity-30"
                        >
                          →
                        </button>
                      </div>
                      <button
                        onClick={() => removeImage(src)}
                        disabled={status.state === "saving"}
                        aria-label="제거"
                        className="rounded bg-red-600/85 px-1.5 py-0.5 text-[10px] text-white transition hover:bg-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-2 rounded-md border border-dashed px-3 py-4 text-center text-[11px] text-[var(--muted)]">
                아직 사진이 없습니다.
              </p>
            )}

            <div className="flex gap-1.5">
              <div className="relative flex flex-1 items-center gap-1.5 rounded-lg border bg-[var(--bg)] px-2 focus-within:border-[var(--fg)]/50">
                <Link2 className="size-3.5 text-[var(--muted)]" strokeWidth={1.75} />
                <input
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addImageUrl();
                    }
                  }}
                  placeholder="이미지 URL"
                  disabled={status.state === "saving" || images.length >= MAX_IMAGES}
                  className="flex-1 bg-transparent py-2 text-sm outline-none disabled:opacity-60"
                />
              </div>
              <button
                onClick={addImageUrl}
                disabled={status.state === "saving" || !imageUrlInput.trim() || images.length >= MAX_IMAGES}
                className="rounded-lg border px-3 text-xs transition hover:border-[var(--fg)]/40 disabled:opacity-50"
              >
                URL 추가
              </button>
            </div>

            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                disabled={status.state === "saving" || uploading || images.length >= MAX_IMAGES}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={status.state === "saving" || uploading || images.length >= MAX_IMAGES}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)] disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    업로드 중…
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" strokeWidth={1.75} />
                    파일 업로드 (자동으로 1280px webp 로 압축)
                  </>
                )}
              </button>
            </div>

            {imageError && (
              <p className="mt-1.5 text-[10px] text-red-600 dark:text-red-300">{imageError}</p>
            )}
            {!imageError && (
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                <ImagePlus className="mr-0.5 inline size-2.5" /> URL 붙여넣기 또는 파일 선택 (다중 가능)
              </p>
            )}
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
