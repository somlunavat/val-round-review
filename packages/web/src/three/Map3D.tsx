import { lazy, Suspense } from "react";
import { Notice } from "../components/Notice.js";
import type { Scene3DProps } from "./Scene3D.js";
import { useBlockout } from "./useBlockout.js";

// three.js is large; load it only when someone opens the 3D view.
const Scene3D = lazy(() => import("./Scene3D.js"));

type Props = Omit<Scene3DProps, "blockout"> & { minimapUrl: string | undefined };

export function Map3D({ minimapUrl, ...scene }: Props) {
  const state = useBlockout(scene.map, minimapUrl);
  if (state.status === "error") {
    return (
      <div className="grid h-full place-items-center p-6">
        <Notice tone="error">{state.message}</Notice>
      </div>
    );
  }
  if (state.status === "loading") return <Loading text="Building blockout…" />;
  return (
    <Suspense fallback={<Loading text="Loading 3D…" />}>
      <Scene3D {...scene} blockout={state.blockout} />
    </Suspense>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="grid h-full place-items-center text-sm text-muted">
      <span className="animate-pulse">{text}</span>
    </div>
  );
}
