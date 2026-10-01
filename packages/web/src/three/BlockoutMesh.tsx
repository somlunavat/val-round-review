import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MapData } from "@replay-lab/shared";
import { toNormalized } from "../maps/calibration.js";
import { SCENE, WALL_HEIGHT, type Blockout } from "./blockout.js";

const FLOOR_LOW = new THREE.Color("#25303c");
const FLOOR_HIGH = new THREE.Color("#5a6a7c");
const SITE_TINT = new THREE.Color("#7a6324");
const WALL = new THREE.Color("#9fb0c4");
const BASE_DEPTH = 1.2;

type Props = {
  map: MapData;
  blockout: Blockout;
  /** Fraction of full wall height; lower in overview so players stay visible. */
  wallScale: number;
};

/** Floors and walls as two instanced meshes with flat shading. */
export function BlockoutMesh({ map, blockout, wallScale }: Props) {
  const floors = useRef<THREE.InstancedMesh>(null);
  const walls = useRef<THREE.InstancedMesh>(null);
  const cell = SCENE / blockout.size;
  const span = Math.max(1, blockout.maxHeight - blockout.minHeight);

  // Site callouts tint nearby floor so A/B/C read at a glance.
  const sites = useMemo(
    () =>
      map.callouts
        .filter((c) => c.name === "Site")
        .map((c) => {
          const n = toNormalized(map, c.pos);
          return { x: n.x * SCENE, z: n.y * SCENE };
        }),
    [map],
  );

  useLayoutEffect(() => {
    const mesh = floors.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    blockout.floors.forEach((r, idx) => {
      const top = (r.height - blockout.minHeight) * blockout.unit;
      const w = (r.i1 - r.i0) * cell;
      const d = (r.j1 - r.j0) * cell;
      const h = top + BASE_DEPTH;
      const cx = (r.i0 * cell + r.i1 * cell) / 2;
      const cz = (r.j0 * cell + r.j1 * cell) / 2;
      m.makeScale(w, h, d).setPosition(cx, top - h / 2, cz);
      mesh.setMatrixAt(idx, m);
      color.lerpColors(FLOOR_LOW, FLOOR_HIGH, (r.height - blockout.minHeight) / span);
      const nearSite = sites.some((s) => Math.hypot(s.x - cx, s.z - cz) < 5.5);
      if (nearSite) color.lerp(SITE_TINT, 0.55);
      mesh.setColorAt(idx, color);
    });
    mesh.count = blockout.floors.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blockout, cell, span, sites]);

  useLayoutEffect(() => {
    const mesh = walls.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const thickness = cell * 0.35;
    const height = WALL_HEIGHT * blockout.unit * wallScale;
    blockout.walls.forEach((w, idx) => {
      const base = (w.base - blockout.minHeight) * blockout.unit;
      const horizontal = w.a.j === w.b.j;
      const len = (horizontal ? w.b.i - w.a.i : w.b.j - w.a.j) * cell;
      const cx = ((w.a.i + w.b.i) / 2) * cell;
      const cz = ((w.a.j + w.b.j) / 2) * cell;
      m.makeScale(
        horizontal ? len + thickness : thickness,
        height,
        horizontal ? thickness : len + thickness,
      );
      m.setPosition(cx, base + height / 2, cz);
      mesh.setMatrixAt(idx, m);
    });
    mesh.count = blockout.walls.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blockout, cell, wallScale]);

  return (
    <group>
      <instancedMesh
        ref={floors}
        args={[undefined, undefined, blockout.floors.length]}
        frustumCulled={false}
        userData={{ occluder: true }}
      >
        <boxGeometry />
        <meshStandardMaterial flatShading roughness={0.95} metalness={0} />
      </instancedMesh>
      <instancedMesh
        ref={walls}
        args={[undefined, undefined, blockout.walls.length]}
        frustumCulled={false}
        userData={{ occluder: true }}
      >
        <boxGeometry />
        <meshStandardMaterial color={WALL} flatShading roughness={0.8} />
      </instancedMesh>
      {/* Ground plane under everything */}
      <mesh rotation-x={-Math.PI / 2} position={[SCENE / 2, -BASE_DEPTH, SCENE / 2]}>
        <planeGeometry args={[SCENE * 3, SCENE * 3]} />
        <meshStandardMaterial color="#0d1218" />
      </mesh>
    </group>
  );
}
