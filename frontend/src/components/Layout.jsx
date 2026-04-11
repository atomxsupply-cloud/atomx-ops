import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import NotificationsBell from './NotificationsBell';
import TopNavTabs from './TopNavTabs';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 h-[100dvh] transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header móvil */}
        <div className="sticky top-0 z-10 flex items-center border-b border-slate-700 bg-slate-900 px-3 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-white mr-3">
            <Menu size={22} />
          </button>
          <span className="text-white font-bold text-lg tracking-wide">ATOM X OPS</span>
        </div>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-3 lg:p-6">
          <div className="mb-3 flex items-start justify-between gap-3 lg:mb-4">
            <div className="flex-1 min-w-0">
              <TopNavTabs />
            </div>
            <NotificationsBell />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
