import type { Metadata } from "next";
import { BoardApp } from "@/components/board/board-app";

export const metadata: Metadata = {
  title: "My board — Greenboard",
  description: "Add tasks, tick them off and watch your board go green.",
};

export default function BoardPage() {
  return <BoardApp />;
}
