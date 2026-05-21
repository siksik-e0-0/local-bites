import { Board } from "@/components/board";
import overridesData from "@/data/places.overrides.json";
import placesData from "@/data/places.json";
import { applyOverrides } from "@/lib/merge";
import type { OverridesFile, PlacesFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Page() {
  const data = placesData as PlacesFile;
  const overrides = overridesData as OverridesFile;
  const merged = applyOverrides(data.places, overrides);
  return (
    <Board
      initialPlaces={merged}
      generatedAt={data.generatedAt}
    />
  );
}
