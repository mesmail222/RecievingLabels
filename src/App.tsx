import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Breadcrumbs } from './components/Breadcrumbs';
import { ApiConnectionBanner } from './components/ApiConnectionBanner';
import { Toaster } from './components/ui/sonner';
import { useApiHealth } from './hooks/useApiHealth';
import { Dashboard } from './components/Dashboard';
import { ReceivingLabelsView } from './components/ReceivingLabelsView';
import { DEFAULT_VIEW } from './config/views';
import type { ViewKey } from './config/views';

const SIDEBAR_COLLAPSED_KEY = 'mo-labels-sidebar-collapsed';

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>(DEFAULT_VIEW);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const apiHealth = useApiHealth();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'b' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-8 py-6 overflow-auto">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="no-print flex flex-wrap items-center justify-between gap-3">
              <Breadcrumbs activeView={activeView} onHomeClick={() => setActiveView('dashboard')} />
            </div>
            <div className="no-print">
              <ApiConnectionBanner status={apiHealth} />
            </div>

            {activeView === 'dashboard' && <Dashboard onNavigate={setActiveView} />}
            {activeView === 'receiving-labels' && <ReceivingLabelsView />}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
