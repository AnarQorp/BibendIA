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
import { DirectorioView } from './components/views/DirectorioView';
import { GlobalAssistantModal } from './components/ai/GlobalAssistantModal';
import { AuthSessionGate } from './components/auth/AuthSessionGate';
import { WorkshopAppointmentsProvider } from './context/WorkshopAppointmentsContext';

declare const __DEMO_ENABLED__: boolean;

const GuidedDemoPlayer = (typeof __DEMO_ENABLED__ !== 'undefined' && __DEMO_ENABLED__)
  ? React.lazy(() => import('./components/demo/GuidedDemoPlayer').then(m => ({ default: m.GuidedDemoPlayer })))
  : null;

const MainContent: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const {
    activeSection,
    setActiveSection,
    setAssistantModalOpen,
    demoFeatureEnabled,
    demoModeActive,
    setDemoModeActive
  } = useDemo();

  const { currentPath } = useRouter();

  // Synchronize currentPath with activeSection
  useEffect(() => {
    let target: 'midia' | 'bandeja' | 'agenda' | 'directorio' | 'presupuestos' | 'seguimientos' | 'proveedores' | 'impacto' | 'configuracion' = 'midia';
    if (currentPath === '/midia' || currentPath === '/') target = 'midia';
    else if (currentPath === '/bandeja') target = 'bandeja';
    else if (currentPath === '/agenda') target = 'agenda';
    else if (currentPath.startsWith('/directorio')) target = 'directorio';
    else if (currentPath === '/presupuestos') target = 'presupuestos';
    else if (currentPath === '/seguimientos') target = 'seguimientos';
    else if (currentPath === '/proveedores') target = 'proveedores';
    else if (currentPath === '/impacto') target = 'impacto';
    else if (currentPath === '/configuracion' || currentPath === '/integraciones') target = 'configuracion';

    if (activeSection !== target) {
      setActiveSection(target);
    }
  }, [currentPath, activeSection, setActiveSection]);

  // Keyboard shortcut handlers: Cmd+K for assistant, Ctrl+Shift+D for demo mode ONLY IF feature enabled
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setAssistantModalOpen(true);
      }
      if (demoFeatureEnabled && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDemoModeActive(!demoModeActive);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setAssistantModalOpen, demoFeatureEnabled, demoModeActive, setDemoModeActive]);

  const renderActiveView = () => {
    // Route matching with fallback to activeSection
    if (currentPath.startsWith('/directorio') || activeSection === 'directorio') {
      return <DirectorioView tenantId={tenantId} />;
    }
    if (currentPath === '/proveedores' || activeSection === 'proveedores') {
      return <ProveedoresWorkshopView />;
    }
    if (currentPath === '/agenda' || activeSection === 'agenda') {
      return <AgendaView tenantId={tenantId} />;
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
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f8fafc] relative">
      {/* Sidebar (drawer on mobile/tablet <lg, fixed column on desktop >=lg) */}
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

      {/* Guided Presenter Player: STRICTLY isolated behind __DEMO_ENABLED__ and active session */}
      {typeof __DEMO_ENABLED__ !== 'undefined' && __DEMO_ENABLED__ && demoModeActive && GuidedDemoPlayer && (
        <React.Suspense fallback={null}>
          <GuidedDemoPlayer />
        </React.Suspense>
      )}
    </div>
  );
};

export function App() {
  const content = (tenantId: string) => (
    <RouterProvider>
      <DemoProvider>
        <WorkshopAppointmentsProvider tenantId={tenantId || null}>
          <MainContent tenantId={tenantId} />
        </WorkshopAppointmentsProvider>
      </DemoProvider>
    </RouterProvider>
  );
  if (typeof __DEMO_ENABLED__ !== 'undefined' && __DEMO_ENABLED__) return content('');
  return <AuthSessionGate expectedAudience="workshop">{(session) => content(session.tenantIds[0] ?? '')}</AuthSessionGate>;
}

export default App;
