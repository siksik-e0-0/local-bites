import type { OverridesFile, Place } from "./types";

export function applyOverrides(places: Place[], file: OverridesFile): Place[] {
  const map = file.overrides ?? {};
  const out: Place[] = [];
  for (const p of places) {
    const ov = map[p.id];
    if (ov?.deleted) continue;
    if (!ov) {
      out.push(p);
      continue;
    }
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
    });
  }
  return out;
}
