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
  lat?: number | null;
  lng?: number | null;
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
    const typenameLower = typename.toLowerCase();
    const looksLikeMenu =
      (typenameLower.includes("menu") &&
        !typenameLower.includes("menucategory") &&
        !typenameLower.includes("menufilter") &&
        typeof rec.name === "string") ||
      (typeof rec.name === "string" && (rec.price != null || rec.menuUrl != null)) ||
      (typeof rec.name === "string" &&
        typeof rec.description === "string" &&
        (rec.priceNumber != null || rec.priceText != null || rec.imageUrl != null));
    if (looksLikeMenu) {
      const name = String(rec.name).trim();
      if (name && !seen.has(name) && !/^주의|^정보|^안내/.test(name) && name.length <= 60) {
        let imageUrl: string | null = null;
        const images = rec.images;
        if (Array.isArray(images) && images.length > 0) {
          const first = images[0] as Record<string, unknown>;
          if (typeof first?.url === "string") imageUrl = first.url;
        }
        if (!imageUrl && typeof rec.menuUrl === "string") imageUrl = rec.menuUrl;
        if (!imageUrl && typeof rec.imageUrl === "string") imageUrl = rec.imageUrl;
        const priceRaw = rec.price ?? rec.priceText ?? rec.priceNumber;
        out.push({
          name,
          price: priceRaw != null ? String(priceRaw).trim() : null,
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

function walkApolloForHours(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const visited = new Set<unknown>();
  const queue: unknown[] = [state];
  const collected: string[] = [];
  const seen = new Set<string>();

  function pushHour(s: string) {
    const t = s.trim();
    if (!t || seen.has(t)) return;
    if (!/[0-9]/.test(t) && !/(휴무|영업|매주|매일|연중)/.test(t)) return;
    if (t.length > 200) return;
    seen.add(t);
    collected.push(t);
  }

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || visited.has(node)) continue;
    visited.add(node);
    const rec = node as Record<string, unknown>;
    const typename = typeof rec.__typename === "string" ? rec.__typename : "";
    const tLower = typename.toLowerCase();
    if (tLower.includes("businesshour") || tLower.includes("bizhour") || tLower.includes("newbusinesshour")) {
      for (const k of ["description", "businessHours", "summary", "hours"]) {
        const v = rec[k];
        if (typeof v === "string") pushHour(v);
      }
      const day = rec.day ?? rec.dayOfWeek;
      const start = rec.businessStartTime ?? rec.openTime ?? rec.start;
      const end = rec.businessEndTime ?? rec.closeTime ?? rec.end;
      if (day && (start || end)) {
        pushHour(`${day} ${start ?? ""}${end ? `~${end}` : ""}`.trim());
      }
    }
    for (const v of Object.values(rec)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return collected.length > 0 ? collected.join("\n") : null;
}

function extractCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return null;
}

function entityCoords(entity: Record<string, unknown>): { lat: number | null; lng: number | null } {
  let lat: number | null = null;
  let lng: number | null = null;
  const latKeys = ["latitude", "lat", "y", "mapy", "coordinateY", "posY"];
  const lngKeys = ["longitude", "lng", "lon", "x", "mapx", "coordinateX", "posX"];
  for (const k of latKeys) {
    if (lat == null) lat = extractCoord(entity[k]);
  }
  for (const k of lngKeys) {
    if (lng == null) lng = extractCoord(entity[k]);
  }
  if (lat != null && lng != null) {
    if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
      if (lng >= 33 && lng <= 39 && lat >= 124 && lat <= 132) {
        const tmp = lat;
        lat = lng;
        lng = tmp;
      }
    }
  }
  return { lat, lng };
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

  const { lat, lng } = entityCoords(entity);

  return {
    name: get("name", "businessName"),
    category: get("category", "categoryName", "businessCategory"),
    address,
    phone: get("phone", "virtualPhone", "businessPhone"),
    businessHours,
    rating: getNum("visitorReviewScore", "reviewScore", "rating"),
    reviewCount: getNum("visitorReviewCount", "reviewCount"),
    heroImageUrl,
    lat,
    lng,
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
  const findMeta = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = meta(k) ?? metaAlt(k);
      if (v) return v;
    }
    return null;
  };
  const title = findMeta("og:title");
  const desc = findMeta("og:description", "description");
  const image = findMeta("og:image", "og:image:secure_url");
  const latRaw = findMeta(
    "og:latitude",
    "place:location:latitude",
    "naver:latitude",
    "geo.position.latitude",
  );
  const lngRaw = findMeta(
    "og:longitude",
    "place:location:longitude",
    "naver:longitude",
    "geo.position.longitude",
  );
  const geoPos = findMeta("geo.position", "ICBM");
  let lat: number | null = latRaw ? Number(latRaw) : null;
  let lng: number | null = lngRaw ? Number(lngRaw) : null;
  if ((lat == null || !Number.isFinite(lat)) && geoPos) {
    const parts = geoPos.split(/[,;]/).map((s) => Number(s.trim()));
    if (parts.length >= 2 && parts.every(Number.isFinite)) {
      lat = parts[0];
      lng = parts[1];
    }
  }
  if (lat != null && !Number.isFinite(lat)) lat = null;
  if (lng != null && !Number.isFinite(lng)) lng = null;
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
    lat,
    lng,
  };
}

function coordsFromUrl(url: string): { lat: number | null; lng: number | null } {
  try {
    const u = new URL(url);
    const params = u.searchParams;

    function inKoreaLatLng(la: number, ln: number): boolean {
      return la >= 33 && la <= 39 && ln >= 124 && ln <= 132;
    }

    let lat: number | null = null;
    let lng: number | null = null;
    for (const k of ["lat", "latitude", "y", "mapy", "centerLat"]) {
      const n = Number(params.get(k));
      if (Number.isFinite(n) && n !== 0 && lat == null) lat = n;
    }
    for (const k of ["lng", "lon", "longitude", "x", "mapx", "centerLng"]) {
      const n = Number(params.get(k));
      if (Number.isFinite(n) && n !== 0 && lng == null) lng = n;
    }

    if (lat == null || lng == null) {
      const c = params.get("c");
      if (c) {
        const parts = c.split(",").map((s) => Number(s));
        if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          const a = parts[0];
          const b = parts[1];
          if (inKoreaLatLng(b, a)) {
            lat = b;
            lng = a;
          } else if (inKoreaLatLng(a, b)) {
            lat = a;
            lng = b;
          }
        }
      }
    }

    if (lat != null && lng != null && !inKoreaLatLng(lat, lng) && inKoreaLatLng(lng, lat)) {
      const t = lat;
      lat = lng;
      lng = t;
    }
    if (lat != null && lng != null && !inKoreaLatLng(lat, lng)) {
      lat = null;
      lng = null;
    }
    return { lat, lng };
  } catch {
    return { lat: null, lng: null };
  }
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

async function fetchHtml(url: string, referer?: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(url, {
      headers: browserHeaders(referer ?? "https://map.naver.com/"),
    });
    if (res.ok) return await res.text();
  } catch {
    // ignore
  }
  return null;
}

const PLACE_TYPES = ["restaurant", "place", "cafe"] as const;

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

  let homeHtml: string | null = null;
  let homeType: (typeof PLACE_TYPES)[number] | null = null;
  let usedUrl: string | null = null;
  for (const t of PLACE_TYPES) {
    const url = `https://m.place.naver.com/${t}/${placeId}/home`;
    const html = await fetchHtml(url);
    if (html) {
      homeHtml = html;
      homeType = t;
      usedUrl = url;
      break;
    }
    await sleep(300 + Math.floor(Math.random() * 400));
  }

  let raw: RawPlace = {};
  let images: string[] = [];
  let menu: MenuItem[] = [];
  let hours: string | null = null;
  let layer: string = "none";
  if (homeHtml) {
    const apollo = extractApolloState(homeHtml);
    if (apollo) {
      const entity = walkApolloForEntity(apollo, placeId);
      if (entity) {
        raw = mergeRaw(raw, fromApollo(entity));
        layer = "apollo";
      }
      images = walkApolloForImages(apollo, placeId);
      menu = walkApolloForMenu(apollo);
      hours = walkApolloForHours(apollo);
    }
    const jsonLd = fromJsonLd(homeHtml);
    raw = mergeRaw(raw, jsonLd);
    if (layer === "none" && (jsonLd.name || jsonLd.address)) layer = "json-ld";
    const meta = fromMeta(homeHtml);
    raw = mergeRaw(raw, meta);
    if (layer === "none" && (meta.name || meta.heroImageUrl)) layer = "meta";
  }

  const tryDeepFetch = layer === "apollo" && homeType != null;
  if (tryDeepFetch && homeType) {
    if (menu.length < 1) {
      await sleep(400 + Math.floor(Math.random() * 500));
      const menuHtml = await fetchHtml(
        `https://m.place.naver.com/${homeType}/${placeId}/menu/list`,
        usedUrl ?? undefined,
      );
      if (menuHtml) {
        const a = extractApolloState(menuHtml);
        if (a) {
          const m = walkApolloForMenu(a);
          if (m.length > menu.length) menu = m;
          const moreImages = walkApolloForImages(a, placeId);
          if (moreImages.length) images = Array.from(new Set([...images, ...moreImages]));
        }
      }
    }

    if (!hours && !raw.businessHours) {
      await sleep(400 + Math.floor(Math.random() * 500));
      const infoHtml = await fetchHtml(
        `https://m.place.naver.com/${homeType}/${placeId}/information`,
        usedUrl ?? undefined,
      );
      if (infoHtml) {
        const a = extractApolloState(infoHtml);
        if (a) {
          const h = walkApolloForHours(a);
          if (h) hours = h;
          const entity = walkApolloForEntity(a, placeId);
          if (entity) {
            const merged = fromApollo(entity);
            raw = mergeRaw(raw, merged);
          }
        }
      }
    }

    if (images.length < 2) {
      await sleep(400 + Math.floor(Math.random() * 500));
      const photoHtml = await fetchHtml(
        `https://m.place.naver.com/${homeType}/${placeId}/photo`,
        usedUrl ?? undefined,
      );
      if (photoHtml) {
        const a = extractApolloState(photoHtml);
        if (a) {
          const moreImages = walkApolloForImages(a, placeId);
          if (moreImages.length) images = Array.from(new Set([...images, ...moreImages]));
        }
      }
    }
  }

  const hasData = raw.name || raw.address;
  if (!hasData && cached) {
    return { ...cached, source: "cache" };
  }

  const category: Category = userCategory ?? inferCategory(raw.category);
  const naverMapUrl = `https://map.naver.com/p/entry/place/${placeId}`;
  const addressCandidate = raw.address ?? cached?.address ?? null;
  const finalAddress = looksLikeAddress(addressCandidate) ? addressCandidate : null;
  const finalHero = raw.heroImageUrl ?? cached?.heroImageUrl ?? null;
  const mergedImages = Array.from(
    new Set([
      ...(finalHero ? [finalHero] : []),
      ...images,
      ...(cached?.images ?? []),
    ]),
  ).slice(0, 10);
  const finalMenu = menu.length > 0 ? menu : cached?.menu ?? [];
  const finalHours = raw.businessHours ?? hours ?? cached?.businessHours ?? null;
  let finalLat = raw.lat ?? cached?.lat ?? null;
  let finalLng = raw.lng ?? cached?.lng ?? null;
  if (finalLat == null || finalLng == null) {
    const fromUrl = coordsFromUrl(finalUrl);
    if (finalLat == null && fromUrl.lat != null) finalLat = fromUrl.lat;
    if (finalLng == null && fromUrl.lng != null) finalLng = fromUrl.lng;
  }

  console.log(
    `  [${shortUrl}] placeId=${placeId} layer=${layer} images=${mergedImages.length} menu=${finalMenu.length} hours=${finalHours ? "y" : "n"} geo=${finalLat != null && finalLng != null ? "y" : "n"} via=${usedUrl ?? "n/a"}`,
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
    businessHours: finalHours,
    rating: raw.rating ?? cached?.rating ?? null,
    reviewCount: raw.reviewCount ?? cached?.reviewCount ?? null,
    heroImageUrl: finalHero,
    tags: deriveTags(finalAddress),
    images: mergedImages,
    menu: finalMenu,
    lat: finalLat,
    lng: finalLng,
    schemaVersion: 2,
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
