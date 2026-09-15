import React, { useEffect } from 'react';
import { DemoProvider, useDemo } from './context/DemoContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MiDiaView } from './components/views/MiDiaView';
import { BandejaView } from './components/views/BandejaView';
import { AgendaView } from './components/views/AgendaView';
import { PresupuestosView } from './components/views/PresupuestosView';
import { SeguimientosView } from './components/views/SeguimientosView';
import { ImpactoView } from './components/views/ImpactoView';
import { IntegracionesView } from './components/views/IntegracionesView';
import { GlobalAssistantModal } from './components/ai/GlobalAssistantModal';
import { GuidedDemoPlayer } from './components/demo/GuidedDemoPlayer';

const MainContent: React.FC = () => {
  const { activeSection, setAssistantModalOpen, demoModeActive, setDemoModeActive } = useDemo();

  // Keyboard shortcut handlers (Cmd+K for assistant, Ctrl+Shift+D for hidden presenter mode)
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

  const renderActiveView = () => {
    switch (activeSection) {
      case 'midia':
        return <MiDiaView />;
      case 'bandeja':
        return <BandejaView />;
      case 'agenda':
        return <AgendaView />;
      case 'presupuestos':
        return <PresupuestosView />;
      case 'seguimientos':
        return <SeguimientosView />;
      case 'impacto':
        return <ImpactoView />;
      case 'integraciones':
        return <IntegracionesView />;
      default:
        return <MiDiaView />;
    }
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

      {/* Floating Modals & Guided Presenter Player */}
      <GlobalAssistantModal />
      <GuidedDemoPlayer />
    </div>
  );
};

export function App() {
  return (
    <DemoProvider>
      <MainContent />
    </DemoProvider>
  );
}

export default App;
