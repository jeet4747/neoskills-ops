const variants = {
  pending_approval: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  partial: 'badge-partial',
  active: 'badge bg-blue-100 text-blue-800',
  completed: 'badge-approved',
};

const labels = {
  pending_approval: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  partial: 'Partial',
  active: 'Active',
  completed: 'Completed',
};

export default function Badge({ status, className = '' }) {
  return (
    <span className={`${variants[status] || 'badge bg-gray-100 text-gray-800'} ${className}`}>
      {labels[status] || status}
    </span>
  );
}
