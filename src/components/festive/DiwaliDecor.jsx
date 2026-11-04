// Festive ornaments shared by the login screen and the Diwali popup.
export function Rangoli({ className = '', petals = 16 }) {
  return (
    <svg viewBox="0 0 240 240" className={className} fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.4">
        <circle cx="120" cy="120" r="116" strokeOpacity="0.28" strokeDasharray="2 11" />
        <circle cx="120" cy="120" r="96" strokeOpacity="0.35" />
        <circle cx="120" cy="120" r="66" strokeOpacity="0.28" strokeDasharray="1 8" />
        <circle cx="120" cy="120" r="40" strokeOpacity="0.22" />
        {Array.from({ length: petals }).map((_, i) => (
          <g key={i} transform={`rotate(${(360 / petals) * i} 120 120)`}>
            <ellipse cx="120" cy="85" rx="6.5" ry="19" strokeOpacity="0.32" />
            <circle cx="120" cy="62" r="2.4" fill="currentColor" stroke="none" opacity="0.4" />
          </g>
        ))}
      </g>
      <circle cx="120" cy="120" r="9" fill="currentColor" fillOpacity="0.22" />
    </svg>
  );
}

export function Diya({ className = '', size = 72, lit = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="diya-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE08A" />
          <stop offset="0.5" stopColor="#FFC300" />
          <stop offset="1" stopColor="#C47A00" />
        </linearGradient>
        <linearGradient id="diya-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF9D6" />
          <stop offset="0.45" stopColor="#FFD34D" />
          <stop offset="1" stopColor="#FF8A00" />
        </linearGradient>
        <radialGradient id="diya-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFB703" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFB703" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="48" r="42" fill="url(#diya-halo)" className="diwali-glow" />

      {lit && (
        <g className="diwali-flicker">
          <path
            d="M60 14 C72 32 82 44 82 56 C82 70 72 78 60 78 C48 78 38 70 38 56 C38 44 48 32 60 14 Z"
            fill="url(#diya-flame)"
          />
          <path
            d="M60 38 C66 47 71 53 71 59 C71 67 66 72 60 72 C54 72 49 67 49 59 C49 53 54 47 60 38 Z"
            fill="#FFF7CE"
            opacity="0.9"
          />
        </g>
      )}

      <path d="M14 84 C24 106 41 116 60 116 C79 116 96 106 106 84 Z" fill="url(#diya-gold)" />
      <ellipse cx="60" cy="84" rx="46" ry="7" fill="#FFE08A" />
      <ellipse cx="60" cy="84" rx="30" ry="3.6" fill="#7A3E00" opacity="0.45" />
      <line x1="60" y1="84" x2="60" y2="74" stroke="#3B1E00" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ className = '', style }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" focusable="false">
      <path
        d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function DiwaliDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="diwali-glow absolute -top-24 -right-16 h-80 w-80 rounded-full bg-amber-400/25 blur-3xl" />
      <div className="diwali-glow absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl" />

      <Rangoli className="absolute -top-16 -right-20 w-72 text-accent-300/40 sm:w-80" />
      <Rangoli className="absolute -bottom-24 -left-24 w-80 text-accent-200/25 sm:w-96" petals={20} />

      <Sparkle className="diwali-twinkle absolute left-[14%] top-[22%] w-3.5 text-accent-200/70" />
      <Sparkle className="diwali-twinkle absolute right-[18%] top-[58%] w-2.5 text-accent-200/60" style={{ animationDelay: '1.1s' }} />
      <Sparkle className="diwali-twinkle absolute left-[26%] bottom-[14%] w-2 text-accent-200/50" style={{ animationDelay: '2s' }} />
      <Sparkle className="diwali-twinkle absolute right-[30%] top-[14%] w-2 text-accent-200/60" style={{ animationDelay: '0.6s' }} />
    </div>
  );
}
