import { useState } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'ns_festive_ganesha_2026';

export default function FestivePopup() {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (sessionStorage.getItem(STORAGE_KEY)) return false;
    sessionStorage.setItem(STORAGE_KEY, '1');
    return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-orange-500 via-red-500 to-amber-400 text-white">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 z-10 p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>

        <div className="relative px-6 py-8 text-center">
          <div className="mx-auto w-24 h-24 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center text-5xl">
            <span role="img" aria-label="Ganesha">🪷</span>
          </div>

          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/90 font-semibold">Shubh Festive Season</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">Happy Ganesh<br />Chaturthi</h1>
          <p className="mt-2 text-white/90 text-sm font-medium">Ganpati Bappa Morya!</p>

          <div className="mt-4 text-sm text-white/90 leading-relaxed px-1">
            <p>
              NeoSkill Learning Solutions wishes you and your family a very happy Ganesh Chaturthi.
            </p>
            <p className="mt-2">
              May Lord Ganesha bless you with wisdom, success and prosperity this festive season.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-white/30 text-xs font-semibold tracking-wider uppercase">
            — Team NeoSkill Learning Solutions
          </div>

          <button
            onClick={() => setOpen(false)}
            className="mt-6 w-full py-3 rounded-2xl bg-white text-red-600 font-bold text-sm hover:bg-red-50 transition-colors"
          >
            Shubh Ashirwad
          </button>
        </div>
      </div>
    </div>
  );
}