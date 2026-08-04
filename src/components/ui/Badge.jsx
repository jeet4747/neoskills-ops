const variants = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-gray-50 text-gray-600 border-gray-200',
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  manager: 'bg-blue-50 text-blue-700 border-blue-200',
  sales: 'bg-teal-50 text-teal-700 border-teal-200',
  ops: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export default function Badge({ status, children, className = '' }) {
  const v = variants[status] || variants.inactive;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium border ${v} ${className}`}>
      {children || (status && status.charAt(0).toUpperCase() + status.slice(1))}
    </span>
  );
}
