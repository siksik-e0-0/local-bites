"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";

declare global {
  interface Window {
    naver?: {
      maps: NaverMaps;
    };
  }
}

interface NaverMaps {
  Map: new (
    el: HTMLElement,
    options: {
      center: NaverLatLng;
      zoom?: number;
      zoomControl?: boolean;
      zoomControlOptions?: { position: number };
      scaleControl?: boolean;
      logoControl?: boolean;
      mapDataControl?: boolean;
    },
  ) => NaverMapInstance;
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new () => NaverLatLngBounds;
  Marker: new (options: {
    map: NaverMapInstance;
    position: NaverLatLng;
    title?: string;
    icon?: { content: string; anchor?: NaverPoint };
  }) => NaverMarker;
  Point: new (x: number, y: number) => NaverPoint;
  Event: {
    addListener: (target: unknown, type: string, handler: () => void) => unknown;
    removeListener: (listener: unknown) => void;
  };
  Position: { TOP_RIGHT: number };
}

type NaverLatLng = object;
type NaverLatLngBounds = { extend(p: NaverLatLng): void };
type NaverMapInstance = {
  fitBounds(b: NaverLatLngBounds, padding?: { top: number; right: number; bottom: number; left: number }): void;
  setCenter(p: NaverLatLng): void;
  setZoom(z: number): void;
};
type NaverMarker = object;
type NaverPoint = object;

const SCRIPT_ID = "lb-naver-maps-script";

type Loaded = "idle" | "loading" | "ready" | "error";

function loadNaverScript(clientId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.naver?.maps) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script error")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Naver Maps 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
}

export function PlaceMap({
  places,
  onSelect,
}: {
  places: Place[];
  onSelect: (place: Place) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const markersRef = useRef<unknown[]>([]);
  const [loaded, setLoaded] = useState<Loaded>("idle");
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  const withGeo = places.filter(
    (p): p is Place & { lat: number; lng: number } =>
      typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );

  useEffect(() => {
    if (!clientId) {
      setLoaded("error");
      return;
    }
    setLoaded("loading");
    loadNaverScript(clientId)
      .then(() => setLoaded("ready"))
      .catch(() => setLoaded("error"));
  }, [clientId]);

  useEffect(() => {
    if (loaded !== "ready" || !containerRef.current || !window.naver?.maps) return;
    const maps = window.naver.maps;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(containerRef.current, {
        center: new maps.LatLng(33.4996, 126.5312),
        zoom: 10,
        zoomControl: true,
        zoomControlOptions: { position: maps.Position.TOP_RIGHT },
        scaleControl: false,
        logoControl: true,
        mapDataControl: false,
      });
    }

    for (const m of markersRef.current) {
      const ml = m as { setMap?: (v: unknown) => void };
      if (typeof ml.setMap === "function") ml.setMap(null);
    }
    markersRef.current = [];

    if (withGeo.length === 0) return;

    const bounds = new maps.LatLngBounds();
    for (const p of withGeo) {
      const pos = new maps.LatLng(p.lat, p.lng);
      bounds.extend(pos);
      const markerHtml = `
        <div style="
          transform: translate(-50%, -100%);
          background: var(--accent, #0f5132);
          color: white;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          border: 2px solid rgba(255,255,255,0.85);
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif;
        ">${p.name.replace(/</g, "&lt;")}</div>
      `;
      const marker = new maps.Marker({
        map: mapRef.current,
        position: pos,
        title: p.name,
        icon: { content: markerHtml },
      });
      maps.Event.addListener(marker, "click", () => onSelect(p));
      markersRef.current.push(marker);
    }

    if (withGeo.length === 1) {
      mapRef.current.setCenter(new maps.LatLng(withGeo[0].lat, withGeo[0].lng));
      mapRef.current.setZoom(14);
    } else {
      mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }, [loaded, withGeo, onSelect]);

  if (loaded === "error" && !clientId) {
    return (
      <div className="grid h-[40vh] place-items-center rounded-2xl border bg-[var(--subtle)]/40 p-6 text-center text-sm text-[var(--muted)]">
        <div className="space-y-1.5">
          <MapPin className="mx-auto size-5" strokeWidth={1.5} />
          <p>지도를 불러올 수 없습니다.</p>
          <p className="text-xs">
            <code className="font-mono">NEXT_PUBLIC_NAVER_MAP_CLIENT_ID</code> 환경변수가 설정되어 있지 않습니다.
          </p>
        </div>
      </div>
    );
  }

  if (loaded === "error") {
    return (
      <div className="grid h-[40vh] place-items-center rounded-2xl border bg-[var(--subtle)]/40 p-6 text-center text-sm text-[var(--muted)]">
        <div className="space-y-1.5">
          <MapPin className="mx-auto size-5" strokeWidth={1.5} />
          <p>지도 스크립트를 불러오지 못했습니다.</p>
          <p className="text-xs">Naver Maps 도메인 등록 또는 키 유효성을 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">지도</h2>
        <span className="text-[11px] text-[var(--muted)]">
          좌표 {withGeo.length}/{places.length}곳 표시
        </span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border bg-[var(--subtle)]/30">
        <div ref={containerRef} className="h-[60vh] w-full sm:h-[70vh]" />
        {loaded !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-[var(--bg)]/60 text-xs text-[var(--muted)]">
            지도 불러오는 중…
          </div>
        )}
        {loaded === "ready" && withGeo.length === 0 && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg border bg-[var(--card)]/95 px-3 py-2 text-xs text-[var(--muted)] shadow-sm">
            아직 좌표 정보가 있는 카드가 없습니다.{" "}
            <span className="opacity-70">FORCE_REFETCH=1 npm run fetch:places 로 데이터 갱신.</span>
          </div>
        )}
      </div>
    </div>
  );
}
