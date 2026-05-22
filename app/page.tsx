import { Board } from "@/components/board";
import { createAdminClient } from "@/lib/supabase";
import type { Category, Place, PlaceComment, PlaceOverride } from "@/lib/types";

export const dynamic = "force-dynamic";

function rowToPlace(row: Record<string, unknown>): Place {
  return {
    id: row.id as string,
    shortUrl: row.short_url as string,
    naverMapUrl: (row.naver_map_url as string | null) ?? `https://map.naver.com/p/entry/place/${row.id}`,
    name: row.name as string,
    category: (row.category as Category) ?? "식당",
    naverCategory: (row.naver_category as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    businessHours: (row.business_hours as string | null) ?? null,
    rating: (row.rating as number | null) ?? null,
    reviewCount: (row.review_count as number | null) ?? null,
    heroImageUrl: (row.hero_image_url as string | null) ?? null,
    tags: (row.tags as string[]) ?? [],
    images: (row.images as string[]) ?? [],
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    schemaVersion: (row.schema_version as number) ?? 2,
    fetchedAt: (row.fetched_at as string) ?? new Date().toISOString(),
    source: (["naver","cache","seed"].includes(row.source as string) ? row.source : "naver") as "naver" | "cache" | "seed",
    description: (row.description as string | null) ?? null,
  };
}

function rowToOverride(row: Record<string, unknown>): PlaceOverride {
  return {
    name: (row.name as string | null) ?? undefined,
    tags: (row.tags as string[] | null) ?? undefined,
    address: row.address as string | null | undefined,
    lat: row.lat as number | null | undefined,
    lng: row.lng as number | null | undefined,
    description: row.description as string | null | undefined,
    businessHours: (row.business_hours as string | null | undefined),
    images: (row.images as string[] | null) ?? undefined,
    deleted: (row.deleted as boolean) ?? false,
    category: (row.category as Category | null) ?? undefined,
  };
}

function applyOverrides(places: Place[], overrideMap: Record<string, PlaceOverride>): Place[] {
  const out: Place[] = [];
  for (const p of places) {
    const ov = overrideMap[p.id];
    if (ov?.deleted) continue;
    if (!ov) { out.push(p); continue; }
    const images = ov.images ?? p.images;
    const heroImageUrl = ov.images ? (ov.images[0] ?? null) : p.heroImageUrl;
    out.push({
      ...p,
      name: ov.name ?? p.name,
      category: ov.category ?? p.category,
      tags: ov.tags ?? p.tags,
      description: ov.description !== undefined ? ov.description : (p.description ?? null),
      images,
      heroImageUrl,
      address: ov.address !== undefined ? ov.address : p.address,
      lat: ov.lat !== undefined ? ov.lat : (p.lat ?? null),
      lng: ov.lng !== undefined ? ov.lng : (p.lng ?? null),
      businessHours: ov.businessHours !== undefined ? ov.businessHours : p.businessHours,
    });
  }
  return out;
}

export default async function Page() {
  const sb = createAdminClient();

  const [placesRes, overridesRes, likesRes, commentsRes] = await Promise.all([
    sb.from("lb_places").select("*").order("created_at", { ascending: true }),
    sb.from("lb_place_overrides").select("*"),
    sb.from("lb_place_likes").select("place_id, count"),
    sb.from("lb_place_comments").select("id, place_id, author, body, created_at").order("created_at", { ascending: true }),
  ]);

  const places = (placesRes.data ?? []).map((r) => rowToPlace(r as Record<string, unknown>));

  const overrideMap: Record<string, PlaceOverride> = {};
  for (const r of overridesRes.data ?? []) {
    const row = r as Record<string, unknown>;
    overrideMap[row.place_id as string] = rowToOverride(row);
  }

  const merged = applyOverrides(places, overrideMap);

  const initialLikes: Record<string, number> = {};
  for (const r of likesRes.data ?? []) {
    const row = r as Record<string, unknown>;
    initialLikes[row.place_id as string] = (row.count as number) ?? 0;
  }

  const initialComments: Record<string, PlaceComment[]> = {};
  for (const r of commentsRes.data ?? []) {
    const row = r as Record<string, unknown>;
    const placeId = row.place_id as string;
    const comment: PlaceComment = {
      id: row.id as string,
      author: row.author as string,
      text: row.body as string,
      createdAt: row.created_at as string,
    };
    initialComments[placeId] = [...(initialComments[placeId] ?? []), comment];
  }

  return (
    <Board
      initialPlaces={merged}
      generatedAt={new Date().toISOString()}
      initialLikes={initialLikes}
      initialComments={initialComments}
      initialScraps={[]}
    />
  );
}
