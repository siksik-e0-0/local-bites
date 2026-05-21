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
  fetchedAt: string;
  source: "naver" | "cache" | "seed";
}

export interface PlacesFile {
  generatedAt: string;
  places: Place[];
}
