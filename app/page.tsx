import { Board } from "@/components/board";
import placesData from "@/data/places.json";
import type { PlacesFile } from "@/lib/types";

export default function Page() {
  const data = placesData as PlacesFile;
  return (
    <Board
      initialPlaces={data.places}
      generatedAt={data.generatedAt}
    />
  );
}
