import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, GraduationCap, Banknote, CheckSquare,
  FileBarChart, Building2, LogOut, X, UserPlus, Trophy, Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'manager' || user?.role === 'admin') {
      api.approvals.count().then((d) => setPendingCount(d.count || 0)).catch(() => {});
    }
  }, [location.pathname, user?.role]);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['sales', 'manager', 'admin'] },
    { to: '/enrollments', icon: GraduationCap, label: 'Enrollments', roles: ['sales', 'manager', 'admin'] },
    {
      to: '/approvals', icon: CheckSquare, label: 'Approvals', roles: ['manager', 'admin'],
      badge: pendingCount > 0 ? pendingCount : null,
    },
    { to: '/payments', icon: Banknote, label: 'Payments', roles: ['sales', 'manager', 'admin'] },
    { to: '/bank-accounts', icon: Building2, label: 'Bank Accounts', roles: ['admin'] },
    { to: '/team', icon: Users, label: 'Team', roles: ['admin'] },
    { to: '/users', icon: UserPlus, label: 'Pending Users', roles: ['manager', 'admin'] },
    { to: '/reports', icon: FileBarChart, label: 'Reports', roles: ['manager', 'admin'] },
  ];

  const items = navItems.filter((item) => item.roles.includes(user?.role));

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 gradient-primary transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent-500 rounded-xl flex items-center justify-center">
                <Trophy size={18} className="text-primary-900" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">NeoOps</h1>
                <p className="text-[10px] text-white/60 tracking-wider uppercase">Sales Command</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white lg:hidden transition-colors">
            <X size={18} />
          </button>
        </div>

        <nav className="p-3 space-y-0.5 mt-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} />
                {item.label}
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center leading-tight">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 bg-accent-500 rounded-xl flex items-center justify-center text-primary-900 text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/50 capitalize">{user?.role === 'sales' ? 'Sales Rep' : user?.role === 'manager' ? 'Manager' : 'Admin'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3.5 py-2.5 text-sm text-white/50 hover:text-red-300 hover:bg-white/10 rounded-xl transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
