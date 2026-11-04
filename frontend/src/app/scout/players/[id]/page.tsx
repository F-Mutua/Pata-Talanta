import { Suspense } from "react";
import PlayerView from "./PlayerView";

export default function ScoutPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  // `params` is request data, so it must be read inside a Suspense boundary.
  return (
    <Suspense fallback={<p className="px-6 py-12 text-[#AEB5C0]">Loading player…</p>}>
      <Resolved params={params} />
    </Suspense>
  );
}

async function Resolved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerView playerId={id} />;
}
