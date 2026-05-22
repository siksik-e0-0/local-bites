import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { extractPlaceId } from "@/lib/naver";
import type { Category } from "@/lib/types";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "siksik-e0-0";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "local-bites";
const BRANCH = process.env.GITHUB_BRANCH ?? "main";
const FILE_PATH = "share_link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AddPayload {
  url?: unknown;
  category?: unknown;
  placeId?: unknown;
  name?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  description?: unknown;
  businessHours?: unknown;
  phone?: unknown;
  menu?: unknown;
}

function isValidShortUrl(u: string): boolean {
  return /^https:\/\/(?:naver\.me|map\.naver\.com|m\.place\.naver\.com)\//i.test(u);
}

export async function POST(req: Request) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "서버 설정 누락: GITHUB_TOKEN" },
      { status: 500 },
    );
  }

  let body: AddPayload;
  try {
    body = (await req.json()) as AddPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const category =
    body.category === "식당" || body.category === "카페" || body.category === "기타"
      ? (body.category as Category)
      : null;

  if (!url || !isValidShortUrl(url)) {
    return NextResponse.json(
      { ok: false, error: "유효한 Naver 지도 단축 URL 이 아닙니다." },
      { status: 400 },
    );
  }

  // placeId: from payload or extracted from URL
  const rawPlaceId =
    typeof body.placeId === "string" && /^\d+$/.test(body.placeId.trim())
      ? body.placeId.trim()
      : extractPlaceId(url);

  // ── share_link write (GitHub Contents API) ──────────────────────────────
  // Keeps GHA pipeline running for full Naver data enrichment.
  const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(BRANCH)}`, {
    headers: ghHeaders,
    cache: "no-store",
  });
  if (!getRes.ok) {
    return NextResponse.json(
      { ok: false, error: `share_link 읽기 실패 (${getRes.status})` },
      { status: 502 },
    );
  }
  const getJson = (await getRes.json()) as { content?: string; sha?: string };
  const currentRaw = getJson.content
    ? Buffer.from(getJson.content, "base64").toString("utf8")
    : "";

  const existingLines = currentRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const alreadyExists = existingLines.some((l) => l.split("|")[0].trim() === url);

  let addedToShareLink = false;
  if (!alreadyExists) {
    const newLine = category ? `${url} | ${category}` : url;
    const trimmedEnd = currentRaw.replace(/\s+$/g, "");
    const nextContent = `${trimmedEnd}${trimmedEnd ? "\n" : ""}${newLine}\n`;

    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `chore(share_link): add ${url}`,
        content: Buffer.from(nextContent, "utf8").toString("base64"),
        sha: getJson.sha,
        branch: BRANCH,
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `share_link 쓰기 실패 (${putRes.status}) ${errText.slice(0, 120)}` },
        { status: 502 },
      );
    }
    addedToShareLink = true;
  }

  // ── Supabase immediate INSERT ──────────────────────────────────────────
  let overrideMessage = "";
  if (rawPlaceId) {
    const sb = createAdminClient();

    // Parse optional fields
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : null;
    const address = typeof body.address === "string" && body.address.trim() ? body.address.trim().slice(0, 200) : null;
    const description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 500) : null;
    const businessHours = typeof body.businessHours === "string" && body.businessHours.trim() ? body.businessHours.trim().slice(0, 500) : null;
    const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim().slice(0, 30) : null;
    const menu = Array.isArray(body.menu) ? (body.menu as { name: string; price: string | null }[]).slice(0, 10) : null;

    const latRaw = typeof body.lat === "string" ? Number(body.lat) : body.lat;
    const lat = typeof latRaw === "number" && Number.isFinite(latRaw) && latRaw >= -90 && latRaw <= 90 ? latRaw : null;
    const lngRaw = typeof body.lng === "string" ? Number(body.lng) : body.lng;
    const lng = typeof lngRaw === "number" && Number.isFinite(lngRaw) && lngRaw >= -180 && lngRaw <= 180 ? lngRaw : null;

    // Upsert place record (immediate display)
    const { error: placeErr } = await sb.from("lb_places").upsert(
      {
        id: rawPlaceId,
        short_url: url,
        naver_map_url: `https://map.naver.com/p/entry/place/${rawPlaceId}`,
        name: name ?? "(이름 없음)",
        category: category ?? "식당",
        address,
        phone,
        menu: menu ?? [],
        lat,
        lng,
        source: "add",
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id", ignoreDuplicates: false },
    );

    if (placeErr) {
      console.error("[add] lb_places upsert error:", placeErr.message);
      overrideMessage = " (즉시 표시 실패, 빌드 후 표시됩니다)";
    } else {
      // Upsert override data if provided
      const overrideFields: Record<string, unknown> = { place_id: rawPlaceId, updated_at: new Date().toISOString() };
      if (name) overrideFields.name = name;
      if (address) overrideFields.address = address;
      if (lat != null) overrideFields.lat = lat;
      if (lng != null) overrideFields.lng = lng;
      if (description) overrideFields.description = description;
      if (businessHours) overrideFields.business_hours = businessHours;
      if (category) overrideFields.category = category;

      if (Object.keys(overrideFields).length > 2) {
        await sb.from("lb_place_overrides").upsert(overrideFields, { onConflict: "place_id" });
      }

      overrideMessage = addedToShareLink ? "" : " (주소/좌표 업데이트됨)";
    }
  }

  if (!addedToShareLink) {
    return NextResponse.json({
      ok: true,
      added: false,
      message: `이미 등록된 URL 입니다.${overrideMessage}`,
    });
  }

  return NextResponse.json({
    ok: true,
    added: true,
    message: `추가 완료. 카드가 바로 표시됩니다.${overrideMessage}`,
  });
}
