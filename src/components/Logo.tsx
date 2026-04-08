export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* App icon background */}
      <rect width="40" height="40" rx="10" fill="url(#logoGrad)" />

      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>

      {/* Left building (shorter) */}
      <rect x="4" y="21" width="12" height="16" rx="1.5" fill="white" opacity="0.92" />
      {/* Left windows */}
      <rect x="6.5" y="24" width="2.5" height="2.5" rx="0.5" fill="#3b82f6" />
      <rect x="11" y="24" width="2.5" height="2.5" rx="0.5" fill="#3b82f6" />
      <rect x="6.5" y="29" width="2.5" height="2.5" rx="0.5" fill="#3b82f6" />
      <rect x="11" y="29" width="2.5" height="2.5" rx="0.5" fill="#3b82f6" />

      {/* Right building (taller) */}
      <rect x="19" y="11" width="14" height="26" rx="1.5" fill="white" />
      {/* Right windows */}
      <rect x="21.5" y="14" width="2.5" height="2.5" rx="0.5" fill="#6366f1" />
      <rect x="27" y="14" width="2.5" height="2.5" rx="0.5" fill="#6366f1" />
      <rect x="21.5" y="19.5" width="2.5" height="2.5" rx="0.5" fill="#6366f1" />
      <rect x="27" y="19.5" width="2.5" height="2.5" rx="0.5" fill="#6366f1" />
      <rect x="21.5" y="25" width="2.5" height="2.5" rx="0.5" fill="#6366f1" />
      <rect x="27" y="25" width="2.5" height="2.5" rx="0.5" fill="#6366f1" />

      {/* Trend line */}
      <polyline
        points="4,33 10,26 19,29 33,11"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      {/* Arrow tip */}
      <polyline
        points="29,9 33,11 31,15"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </svg>
  )
}
