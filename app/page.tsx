import { Board } from "@/components/board";
import commentsData from "@/data/places.comments.json";
import likesData from "@/data/places.likes.json";
import overridesData from "@/data/places.overrides.json";
import placesData from "@/data/places.json";
import scrapsData from "@/data/places.scraps.json";
import { applyOverrides } from "@/lib/merge";
import type {
  CommentsFile,
  LikesFile,
  OverridesFile,
  PlacesFile,
  ScrapsFile,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Page() {
  const data = placesData as PlacesFile;
  const overrides = overridesData as OverridesFile;
  const merged = applyOverrides(data.places, overrides);
  const likes = (likesData as LikesFile).likes;
  const comments = (commentsData as CommentsFile).comments;
  const scrappedIds = (scrapsData as ScrapsFile).scrappedIds;
  return (
    <Board
      initialPlaces={merged}
      generatedAt={data.generatedAt}
      initialLikes={likes}
      initialComments={comments}
      initialScraps={scrappedIds}
    />
  );
}
