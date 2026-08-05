import { Card, CardBody } from './Card';

export default function StatsCard({ icon: Icon, label, value, sub, color = 'primary' }) {
  const gradients = {
    primary: 'from-blue-600 to-blue-400',
    emerald: 'from-emerald-600 to-emerald-400',
    amber: 'from-amber-500 to-orange-400',
    blue: 'from-sky-600 to-sky-400',
    red: 'from-red-500 to-rose-400',
  };

  const icons = {
    primary: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-sky-100 text-sky-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`p-2 sm:p-3 rounded-2xl shrink-0 ${icons[color]}`}>
            {Icon && <Icon size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider truncate">{label}</p>
            <p className="text-base sm:text-2xl font-bold text-gray-900 mt-0.5 break-words">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function GradientStatsCard({ icon: Icon, label, value, color = 'primary', onClick }) {
  const gradients = {
    primary: 'from-blue-600 to-indigo-600',
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    blue: 'from-sky-500 to-blue-600',
    red: 'from-red-500 to-rose-600',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-gradient-to-br ${gradients[color]} p-4 sm:p-5 text-white shadow-lg ${onClick ? 'cursor-pointer hover:opacity-95 active:scale-[0.98] transition-all' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-2.5 bg-white/20 rounded-xl backdrop-blur-sm shrink-0">
          {Icon && <Icon size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-medium text-white/70 uppercase tracking-wider truncate">{label}</p>
          <p className="text-base sm:text-2xl font-bold mt-0.5 break-words">{value}</p>
        </div>
      </div>
    </div>
  );
}
