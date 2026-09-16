import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { NavSection } from '../../types';
import { 
  Home, 
  Inbox, 
  Calendar, 
  FileText, 
  TrendingUp, 
  Sparkles, 
  Settings, 
  Presentation,
  CheckCircle2,
  X
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    activeSection, 
    setActiveSection, 
    conversations, 
    quotes, 
    followups, 
    demoModeActive, 
    setDemoModeActive,
    mobileSidebarOpen,
    setMobileSidebarOpen
  } = useDemo();

  const unreadMessagesCount = conversations.filter(c => c.unread).length;
  const pendingQuotesCount = quotes.filter(q => q.status === 'pending_approval').length;
  const pendingFollowupsCount = followups.filter(f => f.status === 'pending').length;

  const mainNavItems: { id: NavSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'midia', label: 'Inicio', icon: <Home className="w-4 h-4" /> },
    { id: 'bandeja', label: 'Bandeja', icon: <Inbox className="w-4 h-4" />, badge: unreadMessagesCount },
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="w-4 h-4" /> },
    { id: 'presupuestos', label: 'Presupuestos', icon: <FileText className="w-4 h-4" />, badge: pendingQuotesCount },
    { id: 'seguimientos', label: 'Seguimientos', icon: <TrendingUp className="w-4 h-4" />, badge: pendingFollowupsCount },
    { id: 'impacto', label: 'Lo que ha hecho por ti', icon: <Sparkles className="w-4 h-4 text-emerald-400" /> },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden animate-fadeIn"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#0f172a] text-slate-200 border-r border-slate-800 flex flex-col justify-between h-screen select-none shadow-xl transition-transform duration-300 ease-in-out md:static md:w-64 md:translate-x-0 shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
              <img 
                src="./assets/logo_BibendIA.png" 
                alt="BibendIA Logo" 
                className="w-9 h-9 object-contain rounded-xl bg-white/10 p-0.5 border border-slate-700/60 shadow-sm shrink-0" 
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white">Bibend<span className="text-blue-500">IA</span></span>
                </div>
                <p className="text-[11px] font-medium text-slate-400">Recepción por Excepción</p>
              </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
              title="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Workshop Team Badge */}
          <div className="px-3.5 py-2.5 mx-3 my-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
              <div className="truncate">
                <p className="font-bold text-slate-100 truncate">Talleres Etxeberria</p>
                <p className="text-[11px] text-slate-400">2 mecánicos · 1 apoyo</p>
              </div>
            </div>
          </div>

          {/* Main Navigation */}
          <nav className="px-3 py-2 space-y-1">
            {mainNavItems.map(item => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-blue-700' : 'bg-amber-500 text-slate-950 font-extrabold'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Secondary Area */}
        <div className="p-3 border-t border-slate-800/80 space-y-1.5">
          <button
            onClick={() => setActiveSection('integraciones')}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === 'integraciones'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Configuración</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-700/50 px-1.5 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3" /> ERP
            </div>
          </button>

          <div className="pt-1 px-0.5">
            <button
              onClick={() => setDemoModeActive(!demoModeActive)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                demoModeActive
                  ? 'bg-amber-950/50 text-amber-300 border border-amber-700/50'
                  : 'text-slate-400 hover:text-slate-300 bg-slate-800/40 border border-slate-700/40'
              }`}
              title="Modo presentación guiada de 10 pasos"
            >
              <div className="flex items-center gap-2">
                <Presentation className="w-3.5 h-3.5" />
                <span>Modo Demo</span>
              </div>
              <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">
                {demoModeActive ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
