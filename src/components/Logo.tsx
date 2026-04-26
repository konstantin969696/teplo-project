/**
 * SVG logo: simplified radiator with heat waves.
 * Uses currentColor to respect theme.
 */

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Radiator body: 3 vertical fins */}
      <rect x="4" y="10" width="3" height="10" rx="1" />
      <rect x="10.5" y="10" width="3" height="10" rx="1" />
      <rect x="17" y="10" width="3" height="10" rx="1" />
      {/* Bottom connecting bar */}
      <line x1="4" y1="19" x2="20" y2="19" />
      {/* Heat waves */}
      <path d="M6 8 C6 6.5 8 6.5 8 5" />
      <path d="M12 7 C12 5.5 14 5.5 14 4" />
      <path d="M18 8 C18 6.5 20 6.5 20 5" />
    </svg>
  )
}
