import { ICON_GRID_24, ICON_PATHS, ICON_PATHS_FILL, type IconName } from "./icons.generated";

export type { IconName };

interface IconProps {
  name: IconName;
  /** Pixel size (design uses 18–26). */
  size?: number;
  /** Use the filled variant when one exists (FILL 1 in the design). */
  fill?: boolean;
  className?: string;
  /** Accessible name. Omit for purely decorative icons. */
  title?: string;
}

export function Icon({ name, size = 24, fill = false, className, title }: IconProps) {
  const filled = fill && name in ICON_PATHS_FILL;
  const d = filled ? ICON_PATHS_FILL[name as keyof typeof ICON_PATHS_FILL] : ICON_PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox={ICON_GRID_24.has(name) ? "0 0 24 24" : "0 -960 960 960"}
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
      style={{ flexShrink: 0 }}
    >
      {title ? <title>{title}</title> : null}
      <path d={d} />
    </svg>
  );
}
