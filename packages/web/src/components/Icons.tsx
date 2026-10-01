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
