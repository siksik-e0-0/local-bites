export type Category = "식당" | "카페" | "기타";

export interface Place {
  id: string;
  shortUrl: string;
  naverMapUrl: string;
  name: string;
  category: Category;
  naverCategory?: string | null;
  address: string | null;
  phone: string | null;
  businessHours: string | null;
  rating: number | null;
  reviewCount: number | null;
  heroImageUrl: string | null;
  tags: string[];
  images: string[];
  fetchedAt: string;
  source: "naver" | "cache" | "seed";
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  schemaVersion?: number;
}

export interface PlacesFile {
  generatedAt: string;
  places: Place[];
}

export interface PlaceOverride {
  tags?: string[];
  description?: string | null;
  category?: Category;
  name?: string;
  images?: string[];
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  businessHours?: string | null;
  deleted?: boolean;
  updatedAt?: string;
}

export interface OverridesFile {
  version: number;
  overrides: Record<string, PlaceOverride>;
}

export interface PlaceEditPayload {
  tags?: string[];
  description?: string | null;
  category?: Category;
  name?: string;
  images?: string[];
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  businessHours?: string | null;
}

export interface PlaceComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface CommentsFile {
  version: number;
  comments: Record<string, PlaceComment[]>;
}

export interface LikesFile {
  version: number;
  likes: Record<string, number>;
}

export interface ScrapsFile {
  version: number;
  scrappedIds: string[];
}
