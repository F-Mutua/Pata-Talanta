import { Suspense } from "react";
import AnalysisFlow from "./AnalysisFlow";

export default function VideoAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  // `params` is request data, so it must be read inside a Suspense boundary.
  return (
    <Suspense fallback={<p className="px-6 py-12 text-[#AEB5C0]">Loading video…</p>}>
      <Resolved params={params} />
    </Suspense>
  );
}

async function Resolved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalysisFlow videoId={id} />;
}
