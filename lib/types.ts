export type Category = "식당" | "카페" | "기타";

export interface MenuItem {
  name: string;
  price: string | null;
  description: string | null;
  imageUrl: string | null;
}

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
  menu: MenuItem[];
  fetchedAt: string;
  source: "naver" | "cache" | "seed";
  description?: string | null;
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
}
