// A string of 15 lights — one for each day of Diwali.
const BULBS = [
  '#FFF2B8', '#FFC300', '#FF8A00', '#FF3D81', '#FFC300',
  '#FFE08A', '#FF8A00', '#FFC300', '#FF3D81', '#FFC300',
  '#FFE08A', '#FF8A00', '#FFC300', '#FF3D81', '#FFF2B8',
];

function bulbPosition(i) {
  // Quadratic bezier from (0, 16) to (600, 16) with a gentle sag.
  const t = 0.045 + (i / (BULBS.length - 1)) * 0.91;
  const mt = 1 - t;
  const x = mt * mt * 0 + 2 * mt * t * 300 + t * t * 600;
  const y = mt * mt * 16 + 2 * mt * t * 78 + t * t * 16;
  return { x: +x.toFixed(1), y: +y.toFixed(1) };
}

export default function DiwaliLights({ className = '', height = 74 }) {
  return (
    <svg
      viewBox="0 0 600 96"
      className={className}
      style={{ height }}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="dl-bulb-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD34D" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFD34D" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path
        d="M0 16 Q300 78 600 16"
        fill="none"
        stroke="#7A5B12"
        strokeOpacity="0.45"
        strokeWidth="1.4"
      />

      {BULBS.map((color, i) => {
        const { x, y } = bulbPosition(i);
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y + 10}
              r="20"
              fill="url(#dl-bulb-glow)"
              className="diwali-twinkle"
              style={{ animationDelay: `${(i % 5) * 0.42}s` }}
            />
            <line x1={x} y1={y} x2={x} y2={y + 3} stroke="#7A5B12" strokeOpacity="0.55" strokeWidth="1.3" />
            <path
              d={`M${x} ${y + 3} C${x + 4.6} ${y + 7} ${x + 4.6} ${y + 14} ${x} ${y + 16} C${x - 4.6} ${y + 14} ${x - 4.6} ${y + 7} ${x} ${y + 3} Z`}
              fill={color}
              className="diwali-twinkle"
              style={{ animationDelay: `${(i % 5) * 0.42}s` }}
            />
          </g>
        );
      })}
    </svg>
  );
}
