import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Screen-space labels for 3D anchors.
 *
 * The DOM lives outside the <Canvas> (one plain React list), and a projector
 * inside the canvas moves each label every frame. This avoids mounting a React
 * root per label, which breaks when the canvas unmounts under React 19.
 */
export type LabelSpec = {
  id: string;
  anchor: THREE.Vector3;
  text: string;
  kind: "player" | "callout";
  color?: string;
  isSelf?: boolean;
  dead?: boolean;
  dim?: boolean;
  /** Check the sight line from the camera against blockout geometry. */
  occlude?: boolean;
};

export type LabelRegistry = Map<string, HTMLDivElement>;

export function LabelOverlay({
  specs,
  registry,
}: {
  specs: LabelSpec[];
  registry: React.RefObject<LabelRegistry>;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {specs.map((s) => (
        <div
          key={s.id}
          ref={(el) => {
            if (el) registry.current.set(s.id, el);
            else registry.current.delete(s.id);
          }}
          data-occluded="false"
          className="group absolute left-0 top-0 will-change-transform"
          style={{ transform: "translate(-9999px, -9999px)" }}
        >
          {s.kind === "player" ? (
            <div
              className={`whitespace-nowrap border px-1.5 py-px font-cond text-[12px] font-bold uppercase tracking-wide group-data-[occluded=true]:border-dashed group-data-[occluded=true]:opacity-45 ${
                s.isSelf ? "border-bone bg-ink/90 text-bone" : "bg-ink/85 text-bone/90"
              }`}
              style={{
                borderColor: s.isSelf ? undefined : s.color,
                opacity: s.dim ? 0.6 : undefined,
              }}
            >
              {s.text}
              {s.dead ? " ✕" : ""}
              <span className="hidden group-data-[occluded=true]:inline">
                {" "}
                · out of sight (approx.)
              </span>
            </div>
          ) : (
            <div className="whitespace-nowrap font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-bone/45">
              {s.text}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3();

export function LabelProjector({
  specs,
  registry,
}: {
  specs: LabelSpec[];
  registry: React.RefObject<LabelRegistry>;
}) {
  const { camera, size, scene } = useThree();
  const frame = useRef(0);

  useFrame(() => {
    frame.current++;
    const checkOcclusion = frame.current % 5 === 0;
    const occluders: THREE.Object3D[] = [];
    if (checkOcclusion) scene.traverse((o) => o.userData.occluder && occluders.push(o));

    for (const s of specs) {
      const el = registry.current.get(s.id);
      if (!el) continue;
      tmp.copy(s.anchor).project(camera);
      if (tmp.z > 1 || tmp.z < -1) {
        el.style.transform = "translate(-9999px, -9999px)";
        continue;
      }
      const x = ((tmp.x + 1) / 2) * size.width;
      const y = ((1 - tmp.y) / 2) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      el.style.zIndex = String(Math.round((1 - tmp.z) * 1000));

      if (checkOcclusion && s.occlude) {
        const dist = camera.position.distanceTo(s.anchor);
        ray.set(camera.position, tmp.copy(s.anchor).sub(camera.position).normalize());
        ray.far = Math.max(0, dist - 0.3);
        const blocked = ray.intersectObjects(occluders, false).length > 0;
        el.dataset.occluded = String(blocked);
      } else if (!s.occlude) {
        el.dataset.occluded = "false";
      }
    }
  });

  return null;
}
