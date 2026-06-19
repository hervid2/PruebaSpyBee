/**
 * Inline SVG bee mascot used as the Spybee brand mark in the nav/top bar.
 * Self-contained (no asset request) and `aria-hidden`, since it is decorative.
 */
interface BeeIconProps {
  size?: number;
  className?: string;
}

/** Renders the bee logo at the given pixel size. */
export default function BeeIcon({ size = 22, className }: BeeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Wings */}
      <ellipse
        cx="9"
        cy="13"
        rx="6"
        ry="3.5"
        fill="white"
        fillOpacity="0.75"
        transform="rotate(-15 9 13)"
      />
      <ellipse
        cx="23"
        cy="13"
        rx="6"
        ry="3.5"
        fill="white"
        fillOpacity="0.75"
        transform="rotate(15 23 13)"
      />

      {/* Body */}
      <ellipse cx="16" cy="19" rx="6" ry="8" fill="#f2b705" />

      {/* Stripes */}
      <rect x="10" y="16" width="12" height="2.5" rx="1.25" fill="#1a1a1a" fillOpacity="0.45" />
      <rect x="10" y="20" width="12" height="2.5" rx="1.25" fill="#1a1a1a" fillOpacity="0.45" />

      {/* Head */}
      <circle cx="16" cy="10" r="4" fill="#f2b705" />

      {/* Antennae */}
      <line
        x1="13.5"
        y1="6.5"
        x2="11"
        y2="2"
        stroke="#f2b705"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="11" cy="2" r="1" fill="#f2b705" />
      <line
        x1="18.5"
        y1="6.5"
        x2="21"
        y2="2"
        stroke="#f2b705"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="21" cy="2" r="1" fill="#f2b705" />

      {/* Eyes */}
      <circle cx="14" cy="9.5" r="1" fill="#1a1a1a" />
      <circle cx="18" cy="9.5" r="1" fill="#1a1a1a" />

      {/* Stinger */}
      <path d="M16 27 L14.5 30 L16 29 L17.5 30 Z" fill="#1a1a1a" fillOpacity="0.5" />
    </svg>
  );
}
