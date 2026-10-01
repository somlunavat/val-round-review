import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type {
  MapData,
  RoundEvent,
  Snapshot,
  SnapshotPlayer,
  TeamSide,
  Vec2,
} from "@replay-lab/shared";
import type { CameraMode } from "../state/store.js";
import { BlockoutMesh } from "./BlockoutMesh.js";
import { clearOfWalls, SCENE, sceneMapping, type Blockout, type SceneMapping } from "./blockout.js";
import { LabelOverlay, LabelProjector, type LabelRegistry, type LabelSpec } from "./labels.js";

type KillEvent = Extract<RoundEvent, { type: "kill" }>;

const ALLY = "#2ee6c0";
const ENEMY = "#ff5c64";
/** Player proportions in game units. */
const PLAYER_RADIUS = 34;
const PLAYER_HEIGHT = 180;
const EYE_HEIGHT = 160;

export type Scene3DProps = {
  map: MapData;
  blockout: Blockout;
  snapshot: Snapshot | undefined;
  stale: boolean;
  kills: KillEvent[];
  plant: Extract<RoundEvent, { type: "plant" }> | undefined;
  defused: boolean;
  selfTeam: TeamSide | undefined;
  selfPuuid: string;
  labelOf: (puuid: string) => string;
  cameraMode: CameraMode;
  /** POV/follow subject and aim target (puuids, or "spike" for the target). */
  subject: string | undefined;
  target: string | undefined;
  showCallouts: boolean;
};

export default function Scene3D(props: Scene3DProps) {
  const mapping = useMemo(
    () => sceneMapping(props.map, props.blockout),
    [props.map, props.blockout],
  );
  const pov = props.cameraMode === "pov";
  const scale = pov ? 1 : 3.2;
  const registry = useRef<LabelRegistry>(new Map());
  const labels = useLabelSpecs(props, mapping, scale);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ fov: 50, near: 0.05, far: 600, position: [SCENE / 2, 62, SCENE * 1.02] }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0b0e13"]} />
        <fog attach="fog" args={["#0b0e13", 120, 260]} />
        <hemisphereLight args={["#cfe3ff", "#1a2028", 0.9]} />
        <directionalLight position={[60, 120, 40]} intensity={1.6} />
        <directionalLight position={[-40, 60, -60]} intensity={0.4} />

        <BlockoutMesh map={props.map} blockout={props.blockout} wallScale={pov ? 1 : 0.55} />

        {props.plant?.pos && (
          <SpikeMarker
            at={mapping.toScene(props.plant.pos)}
            y={mapping.floorAt(props.plant.pos)}
            unit={mapping.unit}
            active={!props.defused}
          />
        )}

        {props.snapshot && (
          <PlayersLayer
            snapshot={props.snapshot}
            stale={props.stale}
            kills={props.kills}
            mapping={mapping}
            selfTeam={props.selfTeam}
            selfPuuid={props.selfPuuid}
            hide={pov ? props.subject : undefined}
            scale={scale}
          />
        )}

        <CameraRig {...props} mapping={mapping} />
        <LabelProjector specs={labels} registry={registry} />
      </Canvas>
      <LabelOverlay specs={labels} registry={registry} />
    </div>
  );
}

function useLabelSpecs(props: Scene3DProps, mapping: SceneMapping, scale: number): LabelSpec[] {
  const { snapshot, map, cameraMode, subject, showCallouts, selfTeam, selfPuuid, labelOf, stale } =
    props;
  const pov = cameraMode === "pov";
  return useMemo(() => {
    const specs: LabelSpec[] = [];
    if (showCallouts && !pov) {
      for (const c of map.callouts) {
        const s = mapping.toScene(c.pos);
        specs.push({
          id: `callout-${c.region}-${c.name}`,
          kind: "callout",
          anchor: new THREE.Vector3(s.x, mapping.floorAt(c.pos) + 0.3, s.z),
          text:
            c.name === "Site"
              ? `${c.region} Site`
              : c.name === "Spawn"
                ? `${c.region.split(" ")[0]} Spawn`
                : c.name,
        });
      }
    }
    const h = PLAYER_HEIGHT * mapping.unit * scale;
    for (const p of snapshot?.players ?? []) {
      if (pov && p.puuid === subject) continue;
      const s = mapping.toScene(p.pos);
      const lift = p.alive ? h * 1.15 : PLAYER_RADIUS * mapping.unit * scale * 2 + 0.6;
      specs.push({
        id: `player-${p.puuid}`,
        kind: "player",
        anchor: new THREE.Vector3(s.x, mapping.floorAt(p.pos) + lift, s.z),
        text: labelOf(p.puuid),
        color: p.team === selfTeam ? ALLY : ENEMY,
        isSelf: p.puuid === selfPuuid,
        dead: !p.alive,
        dim: stale,
        occlude: pov,
      });
    }
    return specs;
  }, [
    snapshot,
    map,
    mapping,
    scale,
    pov,
    subject,
    showCallouts,
    selfTeam,
    selfPuuid,
    labelOf,
    stale,
  ]);
}

function playerAt(snapshot: Snapshot | undefined, puuid: string | undefined) {
  return puuid ? snapshot?.players.find((p) => p.puuid === puuid) : undefined;
}

function PlayersLayer({
  snapshot,
  stale,
  kills,
  mapping,
  selfTeam,
  selfPuuid,
  hide,
  scale,
}: {
  snapshot: Snapshot;
  stale: boolean;
  kills: KillEvent[];
  mapping: SceneMapping;
  selfTeam: TeamSide | undefined;
  selfPuuid: string;
  hide: string | undefined;
  scale: number;
}) {
  const r = PLAYER_RADIUS * mapping.unit * scale;
  const h = PLAYER_HEIGHT * mapping.unit * scale;
  const chest = (pos: Vec2) => {
    const s = mapping.toScene(pos);
    return new THREE.Vector3(s.x, mapping.floorAt(pos) + h * 0.6, s.z);
  };

  return (
    <group>
      {kills.map((k) => {
        const killer = playerAt(snapshot, k.killer);
        if (!killer) return null;
        return (
          <Line
            key={`${k.t}-${k.victim}`}
            points={[chest(killer.pos), chest(k.victimPos)]}
            color={killer.team === selfTeam ? ALLY : ENEMY}
            lineWidth={3}
            transparent
            opacity={stale ? 0.4 : 0.95}
          />
        );
      })}
      {snapshot.players
        .filter((p) => p.puuid !== hide)
        .map((p) => (
          <PlayerCapsule
            key={p.puuid}
            player={p}
            mapping={mapping}
            radius={r}
            height={h}
            color={p.team === selfTeam ? ALLY : ENEMY}
            isSelf={p.puuid === selfPuuid}
            stale={stale}
          />
        ))}
    </group>
  );
}

function PlayerCapsule({
  player,
  mapping,
  radius,
  height,
  color,
  isSelf,
  stale,
}: {
  player: SnapshotPlayer;
  mapping: SceneMapping;
  radius: number;
  height: number;
  color: string;
  isSelf: boolean;
  stale: boolean;
}) {
  const s = mapping.toScene(player.pos);
  const y = mapping.floorAt(player.pos);
  const dead = !player.alive;
  const opacity = (dead ? 0.55 : 1) * (stale ? 0.55 : 1);
  return (
    <group position={[s.x, y, s.z]}>
      {dead ? (
        // Lying down where they died.
        <mesh position={[0, radius, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[radius, height - radius * 2, 4, 10]} />
          <meshStandardMaterial
            color="#3a4450"
            emissive={color}
            emissiveIntensity={0.25}
            transparent
            opacity={opacity}
          />
        </mesh>
      ) : (
        <mesh position={[0, height / 2, 0]}>
          <capsuleGeometry args={[radius, height - radius * 2, 4, 10]} />
          <meshStandardMaterial color={color} flatShading transparent opacity={opacity} />
        </mesh>
      )}
      {isSelf && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <ringGeometry args={[radius * 1.5, radius * 2, 24]} />
          <meshBasicMaterial color="white" transparent opacity={opacity} />
        </mesh>
      )}
      {/* Team-coloured disc so players read from far away. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <circleGeometry args={[radius * 1.3, 20]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.5} />
      </mesh>
    </group>
  );
}

function SpikeMarker({
  at,
  y,
  unit,
  active,
}: {
  at: { x: number; z: number };
  y: number;
  unit: number;
  active: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const size = 60 * unit * 1.6;
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 1.5;
  });
  return (
    <group position={[at.x, y + size, at.z]}>
      <mesh ref={ref}>
        <octahedronGeometry args={[size]} />
        <meshStandardMaterial
          color={active ? "#ffc83d" : "#6b7280"}
          emissive={active ? "#ffc83d" : "#000"}
          emissiveIntensity={active ? 0.8 : 0}
          flatShading
        />
      </mesh>
      {active && <pointLight color="#ffc83d" intensity={6} distance={12} />}
    </group>
  );
}

/**
 * Overview/top/follow use orbit controls. POV places the camera at the
 * subject's recorded position, at eye height, aimed at the target; dragging
 * looks around from that spot.
 */
function CameraRig(props: Scene3DProps & { mapping: SceneMapping }) {
  const { camera, gl } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const look = useRef({ yaw: 0, pitch: 0 });
  const { mapping, snapshot, cameraMode, subject, target } = props;

  const subjectPlayer = playerAt(snapshot, subject);
  const eye = useMemo(() => {
    if (!subjectPlayer) return undefined;
    const raw = mapping.toScene(subjectPlayer.pos);
    // Approximate positions can sit inside a blockout wall; step onto open floor.
    const s = cameraMode === "pov" ? clearOfWalls(props.blockout, raw.x, raw.z) : raw;
    return new THREE.Vector3(
      s.x,
      mapping.floorAt(subjectPlayer.pos) + EYE_HEIGHT * mapping.unit,
      s.z,
    );
  }, [subjectPlayer, mapping, cameraMode, props.blockout]);

  const aim = useMemo(() => {
    const pos = target === "spike" ? props.plant?.pos : playerAt(snapshot, target)?.pos;
    if (!pos) return undefined;
    const s = mapping.toScene(pos);
    return new THREE.Vector3(s.x, mapping.floorAt(pos) + EYE_HEIGHT * mapping.unit * 0.8, s.z);
  }, [target, snapshot, props.plant, mapping]);

  // Reset look offsets whenever the POV changes.
  useEffect(() => {
    look.current = { yaw: 0, pitch: 0 };
  }, [subject, target, cameraMode, snapshot?.t]);

  // Place the camera when switching overview modes.
  useEffect(() => {
    const c = controls.current;
    if (cameraMode === "orbit") {
      camera.position.set(SCENE / 2, 62, SCENE * 1.02);
      c?.target.set(SCENE / 2, 0, SCENE / 2);
    } else if (cameraMode === "top") {
      camera.position.set(SCENE / 2, 100, SCENE / 2 + 0.01);
      c?.target.set(SCENE / 2, 0, SCENE / 2);
    } else if (cameraMode === "follow" && eye) {
      camera.position.set(eye.x + 12, eye.y + 14, eye.z + 12);
      c?.target.copy(eye);
    }
    c?.update();
    // eye is intentionally read once per mode change; follow keeps tracking below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode, camera]);

  // Drag to look around in POV.
  useEffect(() => {
    if (cameraMode !== "pov") return;
    const el = gl.domElement;
    let dragging = false;
    let last = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      look.current.yaw -= (e.clientX - last.x) * 0.004;
      look.current.pitch = Math.max(
        -1.2,
        Math.min(1.2, look.current.pitch - (e.clientY - last.y) * 0.004),
      );
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      dragging = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
  }, [cameraMode, gl]);

  useFrame(() => {
    if (cameraMode === "pov" && eye) {
      const base = aim ? aim.clone().sub(eye) : new THREE.Vector3(0, 0, -1);
      const yaw0 = Math.atan2(base.x, base.z);
      const pitch0 = Math.atan2(base.y, Math.hypot(base.x, base.z));
      const yaw = yaw0 + look.current.yaw;
      const pitch = pitch0 + look.current.pitch;
      camera.position.lerp(eye, 0.25);
      const dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(camera.position.clone().add(dir));
    } else if (cameraMode === "follow" && eye && controls.current) {
      const c = controls.current;
      const delta = eye.clone().sub(c.target).multiplyScalar(0.15);
      c.target.add(delta);
      camera.position.add(delta);
      c.update();
    }
  });

  if (cameraMode === "pov") return null;
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableRotate={cameraMode !== "top"}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={4}
      maxDistance={220}
      target={[SCENE / 2, 0, SCENE / 2]}
    />
  );
}
