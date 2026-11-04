import { X } from 'lucide-react';
import DiwaliLights from './DiwaliLights';
import { Diya, Rangoli, Sparkle } from './DiwaliDecor';

const WISHES = [
  { icon: '✨', title: 'Light', text: 'May every corner of your life glow with joy.' },
  { icon: '🪔', title: 'Prosperity', text: 'May this season bring growth and new opportunity.' },
  { icon: '🤝', title: 'Togetherness', text: 'May your family and team stay close and strong.' },
];

export default function DiwaliWishes({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#050d1c]/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diwali-wishes-title"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-b from-[#0b1e3a] via-[#0a1830] to-[#071023] shadow-2xl shadow-amber-900/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0">
          <Rangoli className="absolute -right-24 -top-24 w-72 text-amber-300/20" />
          <Rangoli className="absolute -bottom-32 -left-24 w-80 text-amber-300/10" petals={20} />
          <Sparkle className="diwali-twinkle absolute left-[12%] top-[38%] w-2.5 text-amber-200/60" />
          <Sparkle className="diwali-twinkle absolute right-[10%] top-[52%] w-2 text-amber-200/60" style={{ animationDelay: '1.3s' }} />
          <Sparkle className="diwali-twinkle absolute left-[20%] bottom-[18%] w-2 text-amber-200/50" style={{ animationDelay: '2.1s' }} />
        </div>

        <DiwaliLights className="absolute inset-x-0 top-0 w-full opacity-90" height={78} />

        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          aria-label="Close Diwali wishes"
        >
          <X size={18} />
        </button>

        <div className="relative z-10 px-6 pb-7 pt-14 text-center sm:px-8">
          <Diya size={74} className="mx-auto -mt-2 drop-shadow-[0_8px_18px_rgba(255,183,3,0.35)]" />

          <span className="mt-1 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">
            🪔 15 Days of Light · Diwali 2026
          </span>

          <h1
            id="diwali-wishes-title"
            className="mt-4 bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl"
          >
            Happy Diwali
          </h1>
          <p className="mt-1 text-sm font-medium text-amber-200/90">शुभ दीपावली</p>

          <p className="mt-4 text-sm leading-relaxed text-white/75">
            Wishing you and your family a festival filled with light, laughter and endless prosperity.
            May this Diwali bring new energy to every goal you chase together.
          </p>

          <div className="mt-5 grid gap-2 text-left">
            {WISHES.map((w) => (
              <div
                key={w.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5"
              >
                <span className="mt-0.5 text-base leading-none">{w.icon}</span>
                <p className="text-[13px] leading-snug text-white/80">
                  <span className="font-semibold text-amber-200">{w.title}. </span>
                  {w.text}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-white/40">Team NeoSkills</p>

          <button
            onClick={onClose}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 py-3 text-sm font-bold text-[#071023] shadow-lg shadow-amber-500/25 transition-transform hover:brightness-105 active:scale-[0.98]"
          >
            Shubh Deepavali 🪔
          </button>
        </div>
      </div>
    </div>
  );
}
