"use client";

import { Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const JEJU_CENTER = { lat: 33.4996, lng: 126.5312 };

interface ClickEvent {
  coord: { lat: () => number; lng: () => number };
}

interface NaverGlobal {
  maps: {
    Map: new (el: HTMLElement, options: Record<string, unknown>) => unknown;
    LatLng: new (lat: number, lng: number) => unknown;
    Marker: new (options: Record<string, unknown>) => { setPosition: (p: unknown) => void };
    Event: {
      addListener: (target: unknown, type: string, handler: (e: ClickEvent) => void) => unknown;
      removeListener: (listener: unknown) => void;
    };
    Service?: {
      Status: { OK: number };
      geocode: (
        params: { query: string },
        cb: (status: number, response: { v2?: { addresses?: Array<{ x: string; y: string }> } }) => void,
      ) => void;
    };
  };
}

function getNaver(): NaverGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { naver?: NaverGlobal }).naver ?? null;
}

export function LocationPicker({
  lat,
  lng,
  onCoordsChange,
  onGeocodeRequest,
  geocodeAddress,
  disabled,
}: {
  lat: number | null;
  lng: number | null;
  onCoordsChange: (lat: number, lng: number) => void;
  onGeocodeRequest: () => string;
  geocodeAddress: string;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<{ setPosition: (p: unknown) => void } | null>(null);
  const listenerRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocodeAvailable, setGeocodeAvailable] = useState(true);

  // Initialize map once SDK is available
  useEffect(() => {
    if (!containerRef.current) return;
    const naver = getNaver();
    if (!naver?.maps?.Map) {
      // Poll briefly in case the script hasn't finished loading
      const t = setInterval(() => {
        const n = getNaver();
        if (n?.maps?.Map) {
          clearInterval(t);
          setReady(true);
        }
      }, 250);
      const tt = setTimeout(() => clearInterval(t), 5000);
      return () => {
        clearInterval(t);
        clearTimeout(tt);
      };
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const naver = getNaver();
    if (!naver) return;

    const startLat = lat ?? JEJU_CENTER.lat;
    const startLng = lng ?? JEJU_CENTER.lng;
    const center = new naver.maps.LatLng(startLat, startLng);

    const map = new naver.maps.Map(containerRef.current, {
      center,
      zoom: lat != null && lng != null ? 16 : 10,
      zoomControl: true,
      logoControl: false,
      mapDataControl: false,
    });
    mapRef.current = map;

    if (lat != null && lng != null) {
      markerRef.current = new naver.maps.Marker({ map, position: center });
    }

    const listener = naver.maps.Event.addListener(map, "click", (e) => {
      if (disabled) return;
      const la = e.coord.lat();
      const ln = e.coord.lng();
      const pos = new naver.maps.LatLng(la, ln);
      if (markerRef.current) {
        markerRef.current.setPosition(pos);
      } else {
        markerRef.current = new naver.maps.Marker({ map, position: pos });
      }
      onCoordsChange(la, ln);
    });
    listenerRef.current = listener;

    setGeocodeAvailable(typeof naver.maps.Service?.geocode === "function");

    return () => {
      if (listenerRef.current) {
        try {
          naver.maps.Event.removeListener(listenerRef.current);
        } catch {
          // ignore
        }
        listenerRef.current = null;
      }
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Move marker when coords change externally (e.g., user typed new coords)
  useEffect(() => {
    if (!ready) return;
    const naver = getNaver();
    if (!naver || !mapRef.current) return;
    if (lat == null || lng == null) return;
    const pos = new naver.maps.LatLng(lat, lng);
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      markerRef.current = new naver.maps.Marker({
        map: mapRef.current as never,
        position: pos,
      });
    }
    (mapRef.current as { setCenter: (p: unknown) => void }).setCenter(pos);
  }, [lat, lng, ready]);

  function handleGeocode() {
    const addr = onGeocodeRequest();
    if (!addr) {
      setGeocodeError("주소를 입력해 주세요.");
      return;
    }
    const naver = getNaver();
    if (!naver?.maps?.Service?.geocode) {
      setGeocodeError("Geocoding API 미활성화 — NCP Application 에서 'Geocoding' 체크 필요");
      setGeocodeAvailable(false);
      return;
    }
    setGeocoding(true);
    setGeocodeError(null);
    naver.maps.Service.geocode({ query: addr }, (status, response) => {
      setGeocoding(false);
      if (status !== naver.maps.Service!.Status.OK) {
        setGeocodeError("주소를 찾을 수 없습니다.");
        return;
      }
      const first = response.v2?.addresses?.[0];
      if (!first) {
        setGeocodeError("매칭되는 주소가 없습니다.");
        return;
      }
      const la = Number(first.y);
      const ln = Number(first.x);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) {
        setGeocodeError("좌표 변환 실패.");
        return;
      }
      onCoordsChange(la, ln);
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--muted)]">
          {ready ? "지도 클릭으로 좌표 설정" : "지도 로드 중..."}
        </span>
        <button
          type="button"
          onClick={handleGeocode}
          disabled={disabled || geocoding || !geocodeAvailable || !geocodeAddress.trim()}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] text-[var(--muted)] transition hover:border-[var(--fg)]/40 hover:text-[var(--fg)] disabled:opacity-50"
          title={geocodeAvailable ? "주소로 좌표 자동 찾기" : "NCP Application 에서 Geocoding 활성화 필요"}
        >
          {geocoding ? (
            <Loader2 className="size-2.5 animate-spin" />
          ) : (
            <MapPin className="size-2.5" strokeWidth={1.75} />
          )}
          주소로 좌표 찾기
        </button>
      </div>
      <div
        ref={containerRef}
        className="relative h-48 w-full overflow-hidden rounded-md border bg-[var(--subtle)]"
      >
        {!ready && (
          <div className="absolute inset-0 grid place-items-center text-[10px] text-[var(--muted)]">
            지도 SDK 로드 대기 중...
          </div>
        )}
      </div>
      {geocodeError && (
        <p className="text-[10px] text-red-600 dark:text-red-300">{geocodeError}</p>
      )}
    </div>
  );
}
