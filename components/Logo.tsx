export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D79A4C"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 17l10 4 10-4M2 12l10 4 10-4M12 3L2 7l10 4 10-4-10-4z" />
    </svg>
  )
}
