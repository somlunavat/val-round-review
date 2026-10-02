import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MapPalette } from "../maps/palettes.js";
import { SCENE, WALL_HEIGHT, type Blockout } from "./blockout.js";

const BASE_DEPTH = 1.2;

type Props = {
  blockout: Blockout;
  palette: MapPalette;
  /** The map's minimap, draped over floor tops when available. */
  minimap: HTMLImageElement | undefined;
  /** Fraction of full wall height; lower in overview so players stay visible. */
  wallScale: number;
};

/**
 * Floor material: tops show the minimap projected straight down in world space
 * (so site markings, boxes, and ledges line up with the geometry), tinted by the
 * map palette; sides use a darker palette colour so ledges read clearly.
 */
function useFloorMaterial(palette: MapPalette, minimap: HTMLImageElement | undefined) {
  const material = useMemo(() => {
    const texture = minimap ? new THREE.Texture(minimap) : undefined;
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    }
    const mat = new THREE.MeshStandardMaterial({
      flatShading: true,
      roughness: 0.92,
      metalness: 0,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uMinimap = { value: texture ?? null };
      shader.uniforms.uHasMap = { value: texture ? 1 : 0 };
      shader.uniforms.uScene = { value: SCENE };
      shader.uniforms.uTop = { value: new THREE.Color(palette.floor) };
      shader.uniforms.uSide = { value: new THREE.Color(palette.floorSide) };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;",
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec4 wpos = modelMatrix * instanceMatrix * vec4(position, 1.0);
            vWNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          #else
            vec4 wpos = modelMatrix * vec4(position, 1.0);
            vWNormal = normalize(mat3(modelMatrix) * normal);
          #endif
          vWPos = wpos.xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWPos;
          varying vec3 vWNormal;
          uniform sampler2D uMinimap;
          uniform float uHasMap;
          uniform float uScene;
          uniform vec3 uTop;
          uniform vec3 uSide;`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          if (vWNormal.y > 0.5) {
            vec3 top = uTop;
            if (uHasMap > 0.5) {
              vec4 t = texture2D(uMinimap, vec2(vWPos.x / uScene, 1.0 - vWPos.z / uScene));
              // Minimap base floor is ~0.44 grey; rescale so it lands near 1.
              top *= mix(vec3(1.0), clamp(t.rgb * 1.95, 0.0, 1.5), t.a);
            }
            diffuseColor.rgb *= top;
          } else {
            diffuseColor.rgb *= uSide;
          }`,
        );
    };
    // Each map has its own uniforms; keep programs from being shared across them.
    mat.customProgramCacheKey = () => `floor-${minimap ? "map" : "plain"}`;
    return mat;
  }, [palette, minimap]);

  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** Floors and walls as two instanced meshes with flat shading. */
export function BlockoutMesh({ blockout, palette, minimap, wallScale }: Props) {
  const floors = useRef<THREE.InstancedMesh>(null);
  const walls = useRef<THREE.InstancedMesh>(null);
  const cell = SCENE / blockout.size;
  const span = Math.max(1, blockout.maxHeight - blockout.minHeight);
  const floorMaterial = useFloorMaterial(palette, minimap);
  const box = useMemo(() => new THREE.BoxGeometry(), []);

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
      const cx = ((r.i0 + r.i1) / 2) * cell;
      const cz = ((r.j0 + r.j1) / 2) * cell;
      m.makeScale(w, h, d).setPosition(cx, top - h / 2, cz);
      mesh.setMatrixAt(idx, m);
      // Slightly brighter as floors rise, so levels separate even in flat light.
      const lift = 0.86 + 0.18 * ((r.height - blockout.minHeight) / span);
      mesh.setColorAt(idx, color.setScalar(lift));
    });
    mesh.count = blockout.floors.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blockout, cell, span, floorMaterial]);

  useLayoutEffect(() => {
    const mesh = walls.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const thickness = cell * 0.45;
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
        args={[box, floorMaterial, blockout.floors.length]}
        frustumCulled={false}
        userData={{ occluder: true }}
      />
      <instancedMesh
        ref={walls}
        args={[box, undefined, blockout.walls.length]}
        frustumCulled={false}
        userData={{ occluder: true }}
      >
        <meshStandardMaterial color={palette.wall} flatShading roughness={0.85} />
      </instancedMesh>
      {/* Ground plane under everything */}
      <mesh rotation-x={-Math.PI / 2} position={[SCENE / 2, -BASE_DEPTH, SCENE / 2]}>
        <planeGeometry args={[SCENE * 3, SCENE * 3]} />
        <meshStandardMaterial color={palette.sky} />
      </mesh>
    </group>
  );
}
