import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SkullIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3Z" />
    <circle cx="9" cy="12" r="1.6" fill="currentColor" />
    <circle cx="15" cy="12" r="1.6" fill="currentColor" />
    <path d="M10 20v-2M14 20v-2" />
  </Svg>
);

export const SpikeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5 19 12l-7 9.5L5 12z" />
    <path d="M12 7.5v9" />
  </Svg>
);

export const ExplosionIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 2 1.8 5.2L19 5l-2.2 5.2L22 12l-5.2 1.8L19 19l-5.2-2.2L12 22l-1.8-5.2L5 19l2.2-5.2L2 12l5.2-1.8L5 5l5.2 2.2z" />
  </Svg>
);

export const DefuseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5v14M16 5v14" strokeWidth={3} />
  </Svg>
);

export const PrevIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 5v14M18 5 9 12l9 7z" />
  </Svg>
);

export const NextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 5v14M6 5l9 7-9 7z" />
  </Svg>
);

export const CrosshairIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);

/** Icon for how a round ended. */
export function ResultIcon({ result, ...p }: IconProps & { result: string }) {
  switch (result) {
    case "Bomb detonated":
      return <ExplosionIcon {...p} />;
    case "Bomb defused":
      return <DefuseIcon {...p} />;
    case "Round timer expired":
      return <ClockIcon {...p} />;
    default:
      return <SkullIcon {...p} />;
  }
}

// Strategy board tools
export const CursorIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3l14 7-6 2-2 6z" />
  </Svg>
);
export const PenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20c4-1 6-5 9-8s6-5 7-8" />
    <path d="M17 3l4 4" />
  </Svg>
);
export const ArrowIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20C8 12 12 8 19 5" />
    <path d="M13 4l6 1-1 6" />
  </Svg>
);
export const TextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 6V4h14v2M12 4v16M9 20h6" />
  </Svg>
);
export const AgentIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  </Svg>
);
export const SmokeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity="0.25" />
    <circle cx="12" cy="12" r="8" />
  </Svg>
);
export const FlashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M5 19l3.5-3.5M15.5 8.5 19 5" />
  </Svg>
);
export const MollyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-3-1-5 0-7z" />
  </Svg>
);
export const ReconIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const WallIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 19 20 5" strokeWidth={4} />
  </Svg>
);
export const EraserIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 3l5 5-11 11H5l-3-3z" />
    <path d="M12 7l5 5M10 21h11" />
  </Svg>
);
export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);
export const RedoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
