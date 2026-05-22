import { NextResponse } from "next/server";
import { extractPlaceId, fetchPlace, resolveShortUrl } from "@/lib/naver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PreviewBody {
  url?: unknown;
}

function isValidShortUrl(u: string): boolean {
  return /^https:\/\/(?:naver\.me|map\.naver\.com|m\.place\.naver\.com)\//i.test(u);
}

export async function POST(req: Request) {
  let body: PreviewBody;
  try {
    body = (await req.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isValidShortUrl(url)) {
    return NextResponse.json(
      { ok: false, error: "유효한 Naver 지도 단축 URL 이 아닙니다." },
      { status: 400 },
    );
  }

  let resolvedUrl: string;
  try {
    resolvedUrl = await resolveShortUrl(url);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `URL 해석 실패: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const placeId = extractPlaceId(resolvedUrl);
  if (!placeId) {
    return NextResponse.json(
      { ok: false, error: `placeId 추출 실패 — ${resolvedUrl}` },
      { status: 422 },
    );
  }

  try {
    const place = await fetchPlace(url, null, null);
    const validName = place.name && place.name !== "(이름 없음)" ? place.name : null;
    const parserFailed = !validName && !place.address && place.lat == null;
    return NextResponse.json({
      ok: true,
      placeId,
      resolvedUrl,
      name: validName,
      category: place.category,
      address: place.address,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      heroImageUrl: place.heroImageUrl,
      phone: place.phone,
      businessHours: place.businessHours,
      menu: (place.menu ?? []).slice(0, 3),
      parserFailed,
      debug: {
        source: place.source,
        hasHours: !!place.businessHours,
        hasAddress: !!place.address,
        hasCoords: place.lat != null && place.lng != null,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: true,
      placeId,
      resolvedUrl,
      name: null,
      category: null,
      address: null,
      lat: null,
      lng: null,
      heroImageUrl: null,
      businessHours: null,
      parserFailed: true,
      debug: { error: (err as Error).message },
    });
  }
}
