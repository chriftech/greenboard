import { BoardPageSkeleton } from "@/components/board/board-skeleton";

/** Shown while the board opens (for example, when you go to it from the home page). */
export default function BoardLoading() {
  return <BoardPageSkeleton />;
}
