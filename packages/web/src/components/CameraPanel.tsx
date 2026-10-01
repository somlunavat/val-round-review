import type { RoundEvent, Snapshot } from "@replay-lab/shared";
import type { CameraMode, PovSelection, ViewMode } from "../state/store.js";

type KillEvent = Extract<RoundEvent, { type: "kill" }>;

type Props = {
  view: ViewMode;
  cameraMode: CameraMode;
  pov: PovSelection;
  snapshot: Snapshot | undefined;
  kills: KillEvent[];
  plantKnown: boolean;
  labelOf: (puuid: string) => string;
  onView: (view: ViewMode) => void;
  onCameraMode: (mode: CameraMode) => void;
  onPov: (pov: Partial<PovSelection>) => void;
};

const MODES: { id: CameraMode; label: string }[] = [
  { id: "orbit", label: "Orbit" },
  { id: "top", label: "Top" },
  { id: "follow", label: "Follow" },
  { id: "pov", label: "POV" },
];

/** View switch (2D/3D) and, in 3D, camera mode plus POV subject/target pickers. */
export function ViewSwitch({ view, onView }: Pick<Props, "view" | "onView">) {
  return (
    <div className="pointer-events-auto flex border border-line bg-ink/90">
      {(["2d", "3d"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onView(v)}
          className={`px-3 py-1 font-cond text-xs font-bold uppercase tracking-[0.18em] ${
            view === v ? "bg-bone text-ink" : "text-muted hover:text-bone"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function CameraPanel(props: Props) {
  const { cameraMode, pov, snapshot, kills, labelOf, onCameraMode, onPov } = props;
  const present = snapshot?.players ?? [];
  const needsSubject = cameraMode === "pov" || cameraMode === "follow";
  const subjectKnown = present.some((p) => p.puuid === pov.subject);
  const kill = kills[0];

  const goPov = (subject: string | undefined, target: string | undefined) => {
    onPov({ subject, target });
    onCameraMode("pov");
  };

  return (
    <div className="pointer-events-auto w-64 space-y-2.5 border border-line bg-ink/92 p-2.5 text-xs">
      <div className="hud-label !text-[10px]">Camera</div>
      <div className="grid grid-cols-4 border border-line" role="radiogroup" aria-label="Camera">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={cameraMode === m.id}
            onClick={() => onCameraMode(m.id)}
            className={`py-1.5 font-cond text-xs font-bold uppercase tracking-[0.12em] ${
              cameraMode === m.id ? "bg-bone text-ink" : "text-muted hover:text-bone"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {kill && kill.killer && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => goPov(kill.killer, kill.victim)}
            className="cut-sm border-l-2 border-red bg-surface px-2 py-1.5 text-left hover:bg-raised"
          >
            <div className="hud-label !text-[9px]">Killer's view</div>
            <div className="truncate font-cond text-sm font-bold uppercase text-bone">
              {labelOf(kill.killer)}
            </div>
          </button>
          <button
            type="button"
            onClick={() => goPov(kill.victim, kill.killer)}
            className="cut-sm border-l-2 border-soft bg-surface px-2 py-1.5 text-left hover:bg-raised"
          >
            <div className="hud-label !text-[9px]">Victim's view</div>
            <div className="truncate font-cond text-sm font-bold uppercase text-bone">
              {labelOf(kill.victim)}
            </div>
          </button>
        </div>
      )}

      {needsSubject && (
        <div className="space-y-1.5">
          <label className="flex items-center justify-between gap-2">
            <span className="hud-label !text-[10px]">
              {cameraMode === "pov" ? "Eyes of" : "Follow"}
            </span>
            <select
              value={pov.subject ?? ""}
              onChange={(e) => onPov({ subject: e.target.value || undefined })}
              className="w-36 border border-line bg-surface px-1.5 py-1 font-cond text-sm font-semibold uppercase text-bone"
            >
              <option value="">Choose a player</option>
              {present.map((p) => (
                <option key={p.puuid} value={p.puuid}>
                  {labelOf(p.puuid)}
                  {p.alive ? "" : " (dead)"}
                </option>
              ))}
            </select>
          </label>
          {cameraMode === "pov" && (
            <label className="flex items-center justify-between gap-2">
              <span className="hud-label !text-[10px]">Aimed at</span>
              <select
                value={pov.target ?? ""}
                onChange={(e) => onPov({ target: e.target.value || undefined })}
                className="w-36 border border-line bg-surface px-1.5 py-1 font-cond text-sm font-semibold uppercase text-bone"
              >
                <option value="">Nothing</option>
                {present
                  .filter((p) => p.puuid !== pov.subject)
                  .map((p) => (
                    <option key={p.puuid} value={p.puuid}>
                      {labelOf(p.puuid)}
                    </option>
                  ))}
                {props.plantKnown && <option value="spike">Spike</option>}
              </select>
            </label>
          )}
          {pov.subject && !subjectKnown && (
            <p className="text-spike">Position unknown at this moment.</p>
          )}
        </div>
      )}

      {cameraMode === "pov" && (
        <p className="border-t border-line pt-2 leading-snug text-muted">
          Camera sits at the recorded position, at eye height, aimed at your pick. Where they
          actually looked isn't in the data. Drag to look around.
        </p>
      )}
    </div>
  );
}
