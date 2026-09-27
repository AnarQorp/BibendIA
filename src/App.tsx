import React, { useEffect } from 'react';
import { RouterProvider, useRouter } from './router/RouterContext';
import { DemoProvider, useDemo } from './context/DemoContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MiDiaView } from './components/views/MiDiaView';
import { BandejaView } from './components/views/BandejaView';
import { AgendaView } from './components/views/AgendaView';
import { PresupuestosView } from './components/views/PresupuestosView';
import { SeguimientosView } from './components/views/SeguimientosView';
import { ProveedoresWorkshopView } from './components/views/ProveedoresWorkshopView';
import { ImpactoView } from './components/views/ImpactoView';
import { IntegracionesView } from './components/views/IntegracionesView';
import { AdminLayout } from './components/admin/AdminLayout';
import { GlobalAssistantModal } from './components/ai/GlobalAssistantModal';
import { GuidedDemoPlayer } from './components/demo/GuidedDemoPlayer';

const MainContent: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    setAssistantModalOpen,
    demoModeActive,
    setDemoModeActive
  } = useDemo();

  const { currentPath, navigate } = useRouter();

  // Synchronize currentPath with activeSection
  useEffect(() => {
    if (currentPath === '/midia' || currentPath === '/') setActiveSection('midia');
    else if (currentPath === '/bandeja') setActiveSection('bandeja');
    else if (currentPath === '/agenda') setActiveSection('agenda');
    else if (currentPath === '/presupuestos') setActiveSection('presupuestos');
    else if (currentPath === '/seguimientos') setActiveSection('seguimientos');
    else if (currentPath === '/proveedores') setActiveSection('proveedores');
    else if (currentPath === '/impacto') setActiveSection('impacto');
    else if (currentPath === '/configuracion' || currentPath === '/integraciones') setActiveSection('configuracion');
  }, [currentPath, setActiveSection]);

  // Keyboard shortcut handlers (Cmd+K for assistant, Ctrl+Shift+D for demo mode toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setAssistantModalOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDemoModeActive(!demoModeActive);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setAssistantModalOpen, demoModeActive, setDemoModeActive]);

  // Check if current route is for Platform Admin surface (isolated shell)
  if (currentPath.startsWith('/admin')) {
    return <AdminLayout onBackToWorkshop={() => navigate('/midia')} />;
  }

  const renderActiveView = () => {
    // Route matching with fallback to activeSection
    if (currentPath === '/proveedores' || activeSection === 'proveedores') {
      return <ProveedoresWorkshopView />;
    }
    if (currentPath === '/agenda' || activeSection === 'agenda') {
      return <AgendaView />;
    }
    if (currentPath === '/bandeja' || activeSection === 'bandeja') {
      return <BandejaView />;
    }
    if (currentPath === '/presupuestos' || activeSection === 'presupuestos') {
      return <PresupuestosView />;
    }
    if (currentPath === '/seguimientos' || activeSection === 'seguimientos') {
      return <SeguimientosView />;
    }
    if (currentPath === '/impacto' || activeSection === 'impacto') {
      return <ImpactoView />;
    }
    if (currentPath === '/configuracion' || currentPath === '/integraciones' || activeSection === 'configuracion' || activeSection === 'integraciones') {
      return <IntegracionesView />;
    }
    return <MiDiaView />;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] relative">
      {/* Sidebar (drawer on mobile, fixed column on desktop) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto w-full">
        <Header />
        <main className="flex-1 pb-12">
          {renderActiveView()}
        </main>
      </div>

      {/* Floating Modals */}
      <GlobalAssistantModal />

      {/* Guided Presenter Player: STRICTLY isolated behind demoModeActive */}
      {demoModeActive && <GuidedDemoPlayer />}
    </div>
  );
};

export function App() {
  return (
    <RouterProvider>
      <DemoProvider>
        <MainContent />
      </DemoProvider>
    </RouterProvider>
  );
}

export default App;
