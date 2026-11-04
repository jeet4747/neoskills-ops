import { useEffect, useState } from 'react';

const SWEETS = ['🪔', '✨', '🍬', '🍥', '🪔', '🍬'];

// Fixed, deterministic positions so the animation is stable between renders.
const DROPS = Array.from({ length: 18 }, (_, i) => ({
  emoji: SWEETS[i % SWEETS.length],
  left: `${4 + ((i * 37) % 92)}%`,
  delay: +((i % 6) * 0.16 + ((i * 7) % 5) * 0.09).toFixed(2),
  duration: +(4.6 + (i % 5) * 0.45).toFixed(2),
  size: 17 + (i % 4) * 3,
  drift: `${(i % 2 ? 1 : -1) * (18 + (i % 5) * 8)}px`,
  spin: `${(i % 2 ? 1 : -1) * (120 + (i % 4) * 60)}deg`,
}));

const BURSTS = [
  { left: '16%', top: '22%', delay: 0.5, color: '#FFC300', scale: 1 },
  { left: '83%', top: '30%', delay: 0.95, color: '#FF3D81', scale: 0.85 },
  { left: '50%', top: '14%', delay: 1.4, color: '#FF8A00', scale: 0.75 },
];

const RIBBON_TEXT = (
  <>
    <span>🪔 Happy Diwali from Team NeoSkills</span>
    <span className="text-[#8a5600]">•</span>
    <span>शुभ दीपावली</span>
    <span className="text-[#8a5600]">•</span>
    <span>May your year glow with joy, health &amp; prosperity ✨</span>
    <span className="text-[#8a5600]">•</span>
  </>
);

export default function DiwaliEntryCelebration({ active }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 7200);
    return () => clearTimeout(timer);
  }, [active]);

  if (!visible) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
      {/* Scrolling greeting ribbon, tucked just below the header */}
      <div className="dw-ribbon absolute inset-x-0 top-[4.5rem] flex justify-center px-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 py-1.5 shadow-lg shadow-amber-900/20">
          <div className="dw-marquee flex w-max items-center whitespace-nowrap px-4 text-[11px] font-semibold tracking-wide text-[#4a2c00] sm:text-xs">
            <span className="flex items-center gap-8 pr-8">{RIBBON_TEXT}</span>
            <span className="flex items-center gap-8 pr-8">{RIBBON_TEXT}</span>
          </div>
        </div>
      </div>

      {/* Firework bursts */}
      {BURSTS.map((b, bi) => (
        <div key={bi} className="absolute" style={{ left: b.left, top: b.top }}>
          <span
            className="dw-rocket"
            style={{
              '--delay': `${Math.max(0, b.delay - 0.32)}s`,
              background: `linear-gradient(to top, transparent, ${b.color})`,
            }}
          />
          <span
            className="dw-core"
            style={{ '--delay': `${b.delay}s`, background: b.color, boxShadow: `0 0 26px 8px ${b.color}` }}
          />
          <span
            className="dw-ring"
            style={{ '--delay': `${b.delay + 0.02}s`, borderColor: b.color }}
          />
          {Array.from({ length: 16 }).map((_, j) => (
            <span
              key={j}
              className="dw-spark"
              style={{
                '--angle': `${(360 / 16) * j}deg`,
                '--dist': `${(62 + ((j * 13) % 20)) * b.scale}px`,
                '--delay': `${b.delay + 0.04 * (j % 3)}s`,
                background: b.color,
                boxShadow: `0 0 8px ${b.color}`,
              }}
            />
          ))}
        </div>
      ))}

      {/* Falling sweets, diyas and chakli */}
      {DROPS.map((d, i) => (
        <span
          key={i}
          className="dw-drop"
          style={{
            left: d.left,
            fontSize: `${d.size}px`,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
            '--drift': d.drift,
            '--spin': d.spin,
          }}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  );
}
