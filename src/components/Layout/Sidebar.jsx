import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, Banknote, CheckSquare,
  FileBarChart, Building2, LogOut, X, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['sales', 'manager', 'admin'] },
  { to: '/enrollments', icon: GraduationCap, label: 'Enrollments', roles: ['sales', 'manager', 'admin'] },
  { to: '/approvals', icon: CheckSquare, label: 'Approvals', roles: ['manager', 'admin'] },
  { to: '/payments', icon: Banknote, label: 'Payments', roles: ['sales', 'manager', 'admin'] },
  { to: '/bank-accounts', icon: Building2, label: 'Bank Accounts', roles: ['admin'] },
  { to: '/users', icon: UserPlus, label: 'Pending Users', roles: ['manager', 'admin'] },
  { to: '/reports', icon: FileBarChart, label: 'Reports', roles: ['manager', 'admin'] },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();

  const items = navItems.filter((item) => item.roles.includes(user?.role));

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h1 className="text-lg font-bold text-primary-600">NeoOps</h1>
            <p className="text-xs text-gray-400">Sales Performance</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
