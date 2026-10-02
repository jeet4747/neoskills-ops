import { useState } from 'react';
import { X, Target } from 'lucide-react';

const STORAGE_KEY = 'ns_team_target_popup';

export default function MotivationPopup() {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (sessionStorage.getItem(STORAGE_KEY)) return false;
    sessionStorage.setItem(STORAGE_KEY, '1');
    return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 z-10 p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>

        <div className="px-6 sm:px-8 pt-8 pb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/25 px-4 py-1.5">
            <Target size={15} className="text-amber-300" />
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase">Team Target · 200</span>
          </div>

          <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold leading-tight">
            Let’s work as <span className="text-amber-300">ONE TEAM</span>
          </h1>
          <p className="mt-2 text-sm text-white/85">Support each other. Push each other. Build success together.</p>

          <div className="mt-6 space-y-3 text-left">
            <div className="flex gap-3 rounded-2xl bg-white/10 px-4 py-3">
              <span className="text-lg leading-none">💪</span>
              <p className="text-sm leading-snug">Not everyone will motivate you. <b>You</b> have to believe in yourself.</p>
            </div>
            <div className="flex gap-3 rounded-2xl bg-white/10 px-4 py-3">
              <span className="text-lg leading-none">📞</span>
              <p className="text-sm leading-snug">Take the call. Take the action. Tell yourself: <b>“Yes, I can do it!”</b></p>
            </div>
            <div className="flex gap-3 rounded-2xl bg-white/10 px-4 py-3">
              <span className="text-lg leading-none">🚀</span>
              <p className="text-sm leading-snug">Today — one extra call, one extra follow-up, one extra opportunity.</p>
            </div>
          </div>

          <p className="mt-6 text-base font-extrabold tracking-wide text-amber-300">🔥 Believe. Act. Follow Up. Close.</p>
          <p className="mt-1 text-xs text-white/75">You deserve success — you can make it happen.</p>

          <button
            onClick={() => setOpen(false)}
            className="mt-6 w-full py-3 rounded-2xl bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 transition-colors"
          >
            Let’s Go 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
