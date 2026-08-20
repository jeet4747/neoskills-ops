import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Trophy } from 'lucide-react';
import Sidebar from './Sidebar';
import NotificationsBell from './NotificationsBell';
import PushPrompt from './PushPrompt';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-5 gap-3 lg:px-8 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-xl lg:hidden transition-colors"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center lg:hidden">
              <Trophy size={14} className="text-white" />
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-gray-400">NeoOps</span>
              <span className="text-gray-300">/</span>
              <span className="text-gray-700 font-medium">Sales Command Center</span>
            </div>
          </div>
          <div className="flex-1" />
          <NotificationsBell />
        </header>
        <main className="flex-1 overflow-y-auto p-5 lg:p-8 bg-gray-100">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <PushPrompt />
    </div>
  );
}
