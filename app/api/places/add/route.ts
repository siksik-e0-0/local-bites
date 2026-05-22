import { NextResponse } from "next/server";
import { mutateOverrides } from "@/lib/github-overrides";
import type { Category, PlaceOverride } from "@/lib/types";

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
}

function isValidShortUrl(u: string): boolean {
  return /^https:\/\/(?:naver\.me|map\.naver\.com|m\.place\.naver\.com)\//i.test(u);
}

function buildOverridePatch(body: AddPayload): Partial<PlaceOverride> | null {
  const patch: Partial<PlaceOverride> = {};

  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (n) patch.name = n.slice(0, 80);
  }

  if (typeof body.address === "string") {
    const a = body.address.trim();
    if (a) patch.address = a.slice(0, 200);
  }

  if (typeof body.description === "string") {
    const d = body.description.trim();
    if (d) patch.description = d.slice(0, 500);
  }

  if (body.lat !== undefined && body.lat !== null && body.lat !== "") {
    const n = typeof body.lat === "string" ? Number(body.lat) : body.lat;
    if (typeof n === "number" && Number.isFinite(n) && n >= -90 && n <= 90) {
      patch.lat = n;
    }
  }

  if (body.lng !== undefined && body.lng !== null && body.lng !== "") {
    const n = typeof body.lng === "string" ? Number(body.lng) : body.lng;
    if (typeof n === "number" && Number.isFinite(n) && n >= -180 && n <= 180) {
      patch.lng = n;
    }
  }

  if (
    typeof body.category === "string" &&
    (body.category === "식당" || body.category === "카페" || body.category === "기타")
  ) {
    patch.category = body.category as Category;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export async function POST(req: Request) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: "서버 설정 누락: GITHUB_TOKEN 환경 변수가 Vercel 에 설정되지 않았습니다.",
      },
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
      ? body.category
      : null;
  const placeId =
    typeof body.placeId === "string" && /^\d+$/.test(body.placeId.trim())
      ? body.placeId.trim()
      : null;

  if (!url || !isValidShortUrl(url)) {
    return NextResponse.json(
      { ok: false, error: "유효한 Naver 지도 단축 URL 이 아닙니다." },
      { status: 400 },
    );
  }

  const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(BRANCH)}`, {
    headers,
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
      headers: { ...headers, "Content-Type": "application/json" },
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

  let overrideMessage = "";
  const overridePatch = buildOverridePatch(body);
  if (overridePatch && placeId) {
    const result = await mutateOverrides(
      token,
      placeId,
      overridePatch,
      `chore(overrides): seed ${placeId} from add`,
    );
    if (!result.ok) {
      overrideMessage = ` (overrides 저장 실패: ${result.error})`;
    } else {
      overrideMessage = " (주소/좌표 사전 저장됨)";
    }
  }

  if (!addedToShareLink) {
    return NextResponse.json(
      {
        ok: true,
        added: false,
        message: `이미 등록된 URL 입니다.${overrideMessage}`,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    added: true,
    message: `추가 완료. 잠시 후 자동 빌드되어 카드가 나타납니다.${overrideMessage}`,
  });
}
