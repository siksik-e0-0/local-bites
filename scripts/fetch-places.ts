#!/usr/bin/env tsx
/**
 * 독립 실행 스크립트.
 * 사용법:
 *   npm run fetch:places           # share_link 읽고 data/places.json 갱신
 *   FORCE_REFETCH=1 npm run fetch:places
 *   SKIP_FETCH=1 npm run fetch:places   # 아무것도 하지 않음 (캐시 유지)
 *
 * 이 스크립트는 Next.js 와 완전히 독립적입니다.
 * 빌드/렌더와 분리되어 있으며, 산출물(data/places.json)을 화면에서 import 해 사용합니다.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fetchPlace, parseShareLink, sleep } from "../lib/naver";
import type { Place, PlacesFile } from "../lib/types";

const ROOT = path.resolve(__dirname, "..");
const SHARE_LINK_PATH = path.join(ROOT, "share_link");
const DATA_DIR = path.join(ROOT, "data");
const PLACES_PATH = path.join(DATA_DIR, "places.json");
const SEED_PATH = path.join(DATA_DIR, "places.seed.json");

const CACHE_TTL_HOURS = Number(process.env.CACHE_TTL_HOURS ?? "24");
const MAX_FETCHES = Number(process.env.MAX_FETCHES_PER_BUILD ?? "50");
const REQUIRED_SCHEMA_VERSION = 2;

async function readJson<T>(p: string, fallback: T): Promise<T> {
  if (!existsSync(p)) return fallback;
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isAlreadyProcessed(place: Place): boolean {
  // 한 번 성공적으로 fetch 한 URL 은 다시 fetch 하지 않음 (요구사항: 신규만 처리).
  // 단, V1 잘못된 데이터(주소 자리에 리뷰 카운트 등) 또는 V2 형식이 아닌 항목은 재처리.
  if (place.source !== "naver") return false;
  if (!Array.isArray(place.tags)) return false;
  if (!Array.isArray(place.images)) return false;
  if (
    typeof place.address === "string" &&
    /방문자리뷰|블로그리뷰/.test(place.address)
  ) {
    return false;
  }
  if ((place.schemaVersion ?? 1) < REQUIRED_SCHEMA_VERSION) return false;
  return true;
}

void CACHE_TTL_HOURS;

async function main() {
  if (process.env.SKIP_FETCH === "1") {
    console.log("[fetch-places] SKIP_FETCH=1, 캐시 유지");
    return;
  }

  if (!existsSync(SHARE_LINK_PATH)) {
    console.log(`[fetch-places] share_link 파일이 없습니다: ${SHARE_LINK_PATH}`);
    if (!existsSync(PLACES_PATH)) {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(
        PLACES_PATH,
        JSON.stringify({ generatedAt: new Date().toISOString(), places: [] }, null, 2),
        "utf8",
      );
    }
    return;
  }

  const shareLinkRaw = await readFile(SHARE_LINK_PATH, "utf8");
  const entries = parseShareLink(shareLinkRaw);
  console.log(`[fetch-places] share_link 항목 ${entries.length}개`);

  const existing = await readJson<PlacesFile>(PLACES_PATH, {
    generatedAt: new Date().toISOString(),
    places: [],
  });
  const cacheByShortUrl = new Map(existing.places.map((p) => [p.shortUrl, p]));

  const force = process.env.FORCE_REFETCH === "1";
  const results: Place[] = [];
  let fresh = 0;
  let fromCache = 0;
  let failed = 0;
  let fetchesUsed = 0;

  for (const entry of entries) {
    const cached = cacheByShortUrl.get(entry.url) ?? null;

    if (!force && cached && isAlreadyProcessed(cached)) {
      results.push(cached);
      fromCache++;
      console.log(`  [${entry.url}] 이미 처리됨, 건너뜀 (${cached.name})`);
      continue;
    }

    if (fetchesUsed >= MAX_FETCHES) {
      if (cached) {
        results.push({ ...cached, source: "cache" });
        fromCache++;
      } else {
        failed++;
      }
      continue;
    }

    fetchesUsed++;
    try {
      const place = await fetchPlace(entry.url, entry.category, cached);
      if (entry.category) place.category = entry.category;
      results.push(place);
      if (place.source === "naver") fresh++;
      else if (place.source === "cache") fromCache++;
      else failed++;
    } catch (err) {
      console.warn(`  [${entry.url}] 실패:`, (err as Error).message);
      if (cached) {
        results.push({ ...cached, source: "cache" });
        fromCache++;
      } else {
        const shortId = entry.url.replace(/^https?:\/\/naver\.me\//, "");
        results.push({
          id: `pending:${shortId}`,
          shortUrl: entry.url,
          naverMapUrl: entry.url,
          name: "(데이터 갱신 필요)",
          category: entry.category ?? "기타",
          naverCategory: null,
          address: null,
          phone: null,
          businessHours: null,
          rating: null,
          reviewCount: null,
          heroImageUrl: null,
          tags: [],
          images: [],
          menu: [],
          lat: null,
          lng: null,
          fetchedAt: new Date().toISOString(),
          source: "seed",
        });
        failed++;
      }
    }
    await sleep(500 + Math.floor(Math.random() * 1000));
  }

  await mkdir(DATA_DIR, { recursive: true });
  const out: PlacesFile = {
    generatedAt: new Date().toISOString(),
    places: results,
  };
  await writeFile(PLACES_PATH, JSON.stringify(out, null, 2), "utf8");

  console.log(
    `[fetch-places] 완료 — fresh: ${fresh}, cache: ${fromCache}, failed: ${failed}, total: ${results.length}`,
  );
  console.log(`[fetch-places] -> ${path.relative(ROOT, PLACES_PATH)}`);

  // 빌드를 깨지 않기 위해 항상 0 종료
}

main().catch((err) => {
  console.error("[fetch-places] 예외:", err);
  // 빌드 실패 방지 — 캐시 그대로 두고 0 종료
  process.exit(0);
});

// 알 수 없는 IDE를 위한 SEED_PATH 참조 (linter)
void SEED_PATH;
