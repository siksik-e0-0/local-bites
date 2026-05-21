import type { Category, MenuItem, Place } from "./types";

const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

const SEC_CH_UA_POOL = [
  '"Chromium";v="126", "Not.A/Brand";v="24", "Google Chrome";v="126"',
  '"Chromium";v="125", "Not.A/Brand";v="24", "Google Chrome";v="125"',
  '"Chromium";v="124", "Not.A/Brand";v="24", "Google Chrome";v="124"',
];

function pickUa(): { ua: string; secChUa: string } {
  const i = Math.floor(Math.random() * UA_POOL.length);
  return { ua: UA_POOL[i], secChUa: SEC_CH_UA_POOL[i] };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function browserHeaders(referer?: string): HeadersInit {
  const { ua, secChUa } = pickUa();
  return {
    "User-Agent": ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-ch-ua": secChUa,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": referer ? "same-site" : "none",
    "sec-fetch-user": "?1",
    "Upgrade-Insecure-Requests": "1",
    DNT: "1",
    ...(referer ? { Referer: referer } : {}),
  };
}

async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
  attempts = 3,
): Promise<Response> {
  const { timeoutMs = 10_000, ...rest } = init;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: ac.signal });
      clearTimeout(timer);
      if (res.status === 403 || res.status === 429) {
        const wait = (2 ** i) * 1000 + Math.floor(Math.random() * 750);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      const wait = (2 ** i) * 500 + Math.floor(Math.random() * 500);
      await sleep(wait);
    }
  }
  if (lastErr) throw lastErr;
  throw new Error(`fetch failed after ${attempts} attempts: ${url}`);
}

export async function resolveShortUrl(shortUrl: string): Promise<string> {
  let current = shortUrl;
  for (let i = 0; i < 5; i++) {
    const res = await fetchWithRetry(current, {
      method: "GET",
      redirect: "manual",
      headers: browserHeaders(),
    });
    const loc = res.headers.get("location");
    if (!loc) {
      if (res.status >= 200 && res.status < 300) return current;
      throw new Error(`No Location header at hop ${i} for ${current} (status ${res.status})`);
    }
    current = loc.startsWith("http") ? loc : new URL(loc, current).toString();
    if (!current.includes("naver.me")) {
      // Reached final destination
      return current;
    }
  }
  return current;
}

export function extractPlaceId(url: string): string | null {
  const patterns = [
    /\/place\/(\d+)/,
    /\/restaurant\/(\d+)/,
    /\/entry\/place\/(\d+)/,
    /[?&]id=(\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function inferCategory(naverCategory: string | null | undefined): Category {
  if (!naverCategory) return "식당";
  const c = naverCategory.toLowerCase();
  if (c.includes("카페") || c.includes("cafe") || c.includes("디저트") || c.includes("베이커리")) {
    return "카페";
  }
  const foodKeywords = [
    "한식", "일식", "중식", "양식", "분식", "고기", "횟집", "회", "초밥",
    "라멘", "우동", "돈가스", "치킨", "피자", "햄버거", "스시", "면", "백반",
    "찌개", "찜", "탕", "구이", "주점", "포차", "이자카야", "바", "음식",
    "레스토랑", "restaurant", "food", "맛집",
  ];
  if (foodKeywords.some((k) => c.includes(k))) return "식당";
  return "기타";
}

interface RawPlace {
  name?: string | null;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  businessHours?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  heroImageUrl?: string | null;
  images?: string[];
  menu?: MenuItem[];
}

function looksLikeAddress(s: string | null | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  if (/방문자리뷰|블로그리뷰|평점|리뷰\s*\d/.test(t)) return false;
  if (/^[\d.,\s·•]+$/.test(t)) return false;
  const addrKeywords = ["도 ", "시 ", "군 ", "구 ", "읍 ", "면 ", "동 ", "리 ", "로 ", "길 ", "번지"];
  if (addrKeywords.some((k) => t.includes(k))) return true;
  if (t.length >= 8 && t.length <= 100) return true;
  return false;
}

export function deriveTags(address: string | null | undefined): string[] {
  if (!address) return [];
  const out: string[] = [];
  if (address.includes("제주시")) out.push("제주시");
  if (address.includes("서귀포시")) out.push("서귀포시");
  return out;
}

function extractApolloState(html: string): unknown | null {
  const markers = [
    /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
    /__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
    /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  ];
  for (const re of markers) {
    const m = html.match(re);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function walkApolloForEntity(
  state: unknown,
  placeId: string,
): Record<string, unknown> | null {
  if (!state || typeof state !== "object") return null;
  const visited = new Set<unknown>();
  const queue: unknown[] = [state];
  let nameOnlyFallback: Record<string, unknown> | null = null;
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);
    const rec = node as Record<string, unknown>;
    if (rec.id === placeId || rec.id === Number(placeId)) {
      const hasRealAddress =
        looksLikeAddress(rec.roadAddress as string) ||
        looksLikeAddress(rec.address as string) ||
        looksLikeAddress(rec.fullRoadAddress as string) ||
        looksLikeAddress(rec.commonAddress as string) ||
        looksLikeAddress(rec.jibunAddress as string);
      if (hasRealAddress) return rec;
      if (!nameOnlyFallback && (rec.name || rec.businessName)) nameOnlyFallback = rec;
    }
    for (const v of Object.values(rec)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return nameOnlyFallback;
}

function walkApolloForMenu(state: unknown): MenuItem[] {
  if (!state || typeof state !== "object") return [];
  const visited = new Set<unknown>();
  const queue: unknown[] = [state];
  const out: MenuItem[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);
    const rec = node as Record<string, unknown>;
    const typename = typeof rec.__typename === "string" ? rec.__typename : "";
    if (
      (typename.toLowerCase().includes("menu") && typeof rec.name === "string") ||
      (typeof rec.name === "string" && (rec.price != null || rec.menuUrl != null))
    ) {
      const name = String(rec.name).trim();
      if (name && !seen.has(name) && !/^주의|^정보|^안내/.test(name)) {
        let imageUrl: string | null = null;
        const images = rec.images;
        if (Array.isArray(images) && images.length > 0) {
          const first = images[0] as Record<string, unknown>;
          if (typeof first?.url === "string") imageUrl = first.url;
        }
        if (!imageUrl && typeof rec.menuUrl === "string") imageUrl = rec.menuUrl;
        if (!imageUrl && typeof rec.imageUrl === "string") imageUrl = rec.imageUrl;
        out.push({
          name,
          price: rec.price != null ? String(rec.price).trim() : null,
          description:
            typeof rec.description === "string" && rec.description.trim()
              ? rec.description.trim()
              : null,
          imageUrl,
        });
        seen.add(name);
      }
    }
    for (const v of Object.values(rec)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return out.slice(0, 30);
}

function walkApolloForImages(state: unknown, placeId: string): string[] {
  if (!state || typeof state !== "object") return [];
  const visited = new Set<unknown>();
  const queue: unknown[] = [state];
  const urls = new Set<string>();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);
    const rec = node as Record<string, unknown>;
    if (Array.isArray(rec.images)) {
      for (const img of rec.images) {
        if (img && typeof img === "object") {
          const o = img as Record<string, unknown>;
          for (const k of ["url", "origin", "fullPath", "imageUrl"]) {
            const v = o[k];
            if (typeof v === "string" && v.startsWith("http")) urls.add(v);
          }
        } else if (typeof img === "string" && img.startsWith("http")) {
          urls.add(img);
        }
      }
    }
    for (const v of Object.values(rec)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  void placeId;
  return Array.from(urls).slice(0, 10);
}

function fromApollo(entity: Record<string, unknown>): RawPlace {
  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = entity[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const getNum = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = entity[k];
      if (typeof v === "number" && !Number.isNaN(v)) return v;
    }
    return null;
  };
  let heroImageUrl: string | null = null;
  const images = entity.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0] as Record<string, unknown>;
    if (typeof first?.url === "string") heroImageUrl = first.url;
  }
  if (!heroImageUrl) heroImageUrl = get("thumUrl", "imageUrl", "imageURL");

  let businessHours: string | null = null;
  const bh = entity.businessHours ?? entity.bizHour ?? entity.newBusinessHours;
  if (typeof bh === "string") businessHours = bh;
  else if (Array.isArray(bh)) {
    businessHours = bh
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          if (typeof o.description === "string") return o.description;
          if (typeof o.businessHours === "string") return o.businessHours;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  const addressCandidate = get(
    "roadAddress",
    "fullRoadAddress",
    "roadAddr",
    "commonAddress",
    "address",
    "jibunAddress",
    "addressNo",
  );
  const address = looksLikeAddress(addressCandidate) ? addressCandidate : null;

  return {
    name: get("name", "businessName"),
    category: get("category", "categoryName", "businessCategory"),
    address,
    phone: get("phone", "virtualPhone", "businessPhone"),
    businessHours,
    rating: getNum("visitorReviewScore", "reviewScore", "rating"),
    reviewCount: getNum("visitorReviewCount", "reviewCount"),
    heroImageUrl,
  };
}

function fromJsonLd(html: string): RawPlace {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        if (o["@type"] && String(o["@type"]).toLowerCase().includes("restaurant")) {
          const addr = (() => {
            const a = o.address;
            if (typeof a === "string") return a;
            if (a && typeof a === "object") {
              const ao = a as Record<string, unknown>;
              return [ao.streetAddress, ao.addressLocality, ao.addressRegion]
                .filter(Boolean)
                .join(" ");
            }
            return null;
          })();
          const image = (() => {
            const i = o.image;
            if (typeof i === "string") return i;
            if (Array.isArray(i) && typeof i[0] === "string") return i[0];
            return null;
          })();
          const rating = (() => {
            const r = o.aggregateRating;
            if (r && typeof r === "object") {
              const ro = r as Record<string, unknown>;
              const v = ro.ratingValue;
              if (typeof v === "number") return v;
              if (typeof v === "string") return Number(v) || null;
            }
            return null;
          })();
          return {
            name: typeof o.name === "string" ? o.name : null,
            category: typeof o.servesCuisine === "string" ? o.servesCuisine : null,
            address: looksLikeAddress(addr) ? addr : null,
            phone: typeof o.telephone === "string" ? o.telephone : null,
            businessHours: typeof o.openingHours === "string" ? o.openingHours : null,
            rating,
            reviewCount: null,
            heroImageUrl: image,
          };
        }
      }
    } catch {
      // ignore
    }
  }
  return {};
}

function fromMeta(html: string): RawPlace {
  const meta = (prop: string): string | null => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    return m ? m[1].trim() : null;
  };
  const metaAlt = (prop: string): string | null => {
    const re = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "i",
    );
    const m = html.match(re);
    return m ? m[1].trim() : null;
  };
  const title = meta("og:title") || metaAlt("og:title");
  const desc = meta("og:description") || metaAlt("og:description") || meta("description");
  const image = meta("og:image") || metaAlt("og:image");
  let name: string | null = null;
  if (title) {
    name = title.replace(/\s*[:|-]\s*네이버.*$/, "").trim();
  }
  return {
    name,
    category: null,
    address: looksLikeAddress(desc) ? desc : null,
    phone: null,
    businessHours: null,
    rating: null,
    reviewCount: null,
    heroImageUrl: image,
  };
}

function mergeRaw(...parts: RawPlace[]): RawPlace {
  const out: RawPlace = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p)) {
      if (v != null && v !== "" && (out as Record<string, unknown>)[k] == null) {
        (out as Record<string, unknown>)[k] = v;
      }
    }
  }
  return out;
}

export async function fetchPlace(
  shortUrl: string,
  userCategory: Category | null,
  cached: Place | null,
): Promise<Place> {
  const finalUrl = await resolveShortUrl(shortUrl);
  const placeId = extractPlaceId(finalUrl);
  if (!placeId) {
    throw new Error(`Could not extract place ID from ${finalUrl}`);
  }

  const pageUrls = [
    `https://m.place.naver.com/restaurant/${placeId}/home`,
    `https://m.place.naver.com/place/${placeId}/home`,
    `https://m.place.naver.com/cafe/${placeId}/home`,
  ];

  let html: string | null = null;
  let usedUrl: string | null = null;
  for (const url of pageUrls) {
    try {
      const res = await fetchWithRetry(url, {
        headers: browserHeaders("https://map.naver.com/"),
      });
      if (res.ok) {
        html = await res.text();
        usedUrl = url;
        break;
      }
    } catch {
      // try next
    }
    await sleep(300 + Math.floor(Math.random() * 400));
  }

  let raw: RawPlace = {};
  let images: string[] = [];
  let menu: MenuItem[] = [];
  let layer: string = "none";
  if (html) {
    const apollo = extractApolloState(html);
    if (apollo) {
      const entity = walkApolloForEntity(apollo, placeId);
      if (entity) {
        raw = mergeRaw(raw, fromApollo(entity));
        layer = "apollo";
      }
      images = walkApolloForImages(apollo, placeId);
      menu = walkApolloForMenu(apollo);
    }
    const jsonLd = fromJsonLd(html);
    raw = mergeRaw(raw, jsonLd);
    if (layer === "none" && (jsonLd.name || jsonLd.address)) layer = "json-ld";
    const meta = fromMeta(html);
    raw = mergeRaw(raw, meta);
    if (layer === "none" && (meta.name || meta.heroImageUrl)) layer = "meta";
  }

  const hasData = raw.name || raw.address;
  if (!hasData && cached) {
    return { ...cached, source: "cache" };
  }

  const category: Category = userCategory ?? inferCategory(raw.category);
  const naverMapUrl = `https://map.naver.com/p/entry/place/${placeId}`;
  const finalAddress = raw.address ?? cached?.address ?? null;
  const finalHero = raw.heroImageUrl ?? cached?.heroImageUrl ?? null;
  const mergedImages = Array.from(
    new Set([
      ...(finalHero ? [finalHero] : []),
      ...images,
      ...(cached?.images ?? []),
    ]),
  ).slice(0, 10);
  const finalMenu = menu.length > 0 ? menu : cached?.menu ?? [];

  console.log(
    `  [${shortUrl}] placeId=${placeId} layer=${layer} images=${mergedImages.length} menu=${finalMenu.length} via=${usedUrl ?? "n/a"}`,
  );

  return {
    id: placeId,
    shortUrl,
    naverMapUrl,
    name: raw.name ?? cached?.name ?? "(이름 없음)",
    category,
    naverCategory: raw.category ?? cached?.naverCategory ?? null,
    address: finalAddress,
    phone: raw.phone ?? cached?.phone ?? null,
    businessHours: raw.businessHours ?? cached?.businessHours ?? null,
    rating: raw.rating ?? cached?.rating ?? null,
    reviewCount: raw.reviewCount ?? cached?.reviewCount ?? null,
    heroImageUrl: finalHero,
    tags: deriveTags(finalAddress),
    images: mergedImages,
    menu: finalMenu,
    fetchedAt: new Date().toISOString(),
    source: hasData ? "naver" : cached ? "cache" : "seed",
  };
}

export interface ShareLinkEntry {
  url: string;
  category: Category | null;
}

export function parseShareLink(contents: string): ShareLinkEntry[] {
  const out: ShareLinkEntry[] = [];
  const seen = new Set<string>();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [urlPart, catPart] = line.split("|").map((s) => s.trim());
    if (!urlPart || !/^https?:\/\//.test(urlPart)) continue;
    if (seen.has(urlPart)) continue;
    seen.add(urlPart);
    let category: Category | null = null;
    if (catPart === "식당" || catPart === "카페" || catPart === "기타") {
      category = catPart;
    }
    out.push({ url: urlPart, category });
  }
  return out;
}

export { sleep };
