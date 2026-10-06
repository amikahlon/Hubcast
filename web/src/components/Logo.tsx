/** Hubcast mark: a cloud over a small route of hubs. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Hubcast"
    >
      <rect width="32" height="32" rx="9" fill="var(--logo-bg)" />
      <path
        d="M10 19.5a4.2 4.2 0 0 1 .5-8.37 6.2 6.2 0 0 1 11.7 1.4A3.5 3.5 0 0 1 22 19.5z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.5 24.5h13" stroke="#fff" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.7" />
      <circle cx="9.5" cy="24.5" r="1.7" fill="#fff" />
      <circle cx="16" cy="24.5" r="1.7" fill="#fff" />
      <circle cx="22.5" cy="24.5" r="1.7" fill="#fff" />
    </svg>
  );
}
