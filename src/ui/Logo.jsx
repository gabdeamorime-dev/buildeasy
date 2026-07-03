/** Marque BuildEasy — chantier empilé + badge validation */

export function LogoMark({ size = 32, className, title = 'BuildEasy' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="be-logo-bg" x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse">
          <stop stopColor="#152238" />
          <stop offset="1" stopColor="#1e3d5c" />
        </linearGradient>
        <linearGradient id="be-logo-accent" x1="280" y1="168" x2="380" y2="288" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffc14d" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#be-logo-bg)" />
      <rect x="96" y="368" width="320" height="36" rx="10" fill="#fff" fillOpacity=".92" />
      <rect x="128" y="248" width="256" height="104" rx="14" fill="#fff" />
      <path d="M148 248V168l108-76 108 76v80H148z" fill="#fff" />
      <rect x="292" y="188" width="88" height="88" rx="20" fill="url(#be-logo-accent)" />
      <path
        d="M318 236l22 22 44-48"
        stroke="#152238"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ size = 32, showText = false, textClassName, className }) {
  if (!showText) {
    return <LogoMark size={size} className={className} />
  }

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}>
      <LogoMark size={size} />
      <span
        className={textClassName}
        style={{
          fontSize: size * 0.62,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'inherit',
          lineHeight: 1,
        }}
      >
        BuildEasy
      </span>
    </span>
  )
}
