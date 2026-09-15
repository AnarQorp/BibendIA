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
  Wrench,
  CheckCircle2
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeSection, setActiveSection, conversations, quotes, followups, demoModeActive, setDemoModeActive } = useDemo();

  const unreadMessagesCount = conversations.filter(c => c.unread).length;
  const pendingQuotesCount = quotes.filter(q => q.status === 'pending_approval').length;
  const pendingFollowupsCount = followups.filter(f => f.status === 'pending').length;

  const mainNavItems: { id: NavSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'midia', label: 'Inicio', icon: <Home className="w-5 h-5" /> },
    { id: 'bandeja', label: 'Bandeja', icon: <Inbox className="w-5 h-5" />, badge: unreadMessagesCount },
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="w-5 h-5" /> },
    { id: 'presupuestos', label: 'Presupuestos', icon: <FileText className="w-5 h-5" />, badge: pendingQuotesCount },
    { id: 'seguimientos', label: 'Seguimientos', icon: <TrendingUp className="w-5 h-5" />, badge: pendingFollowupsCount },
    { id: 'impacto', label: 'Lo que ha hecho por ti', icon: <Sparkles className="w-5 h-5 text-amber-400" /> },
  ];

  return (
    <aside className="w-64 bg-[#080c14] border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-slate-950 flex items-center justify-center shadow-md font-extrabold text-base">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-white">Bibend<span className="text-orange-500">IA</span></span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Recepción Taller</p>
            </div>
          </div>
        </div>

        {/* Workshop Team Badge (Correction: 2 mecánicos · 1 apoyo) */}
        <div className="px-4 py-3 mx-3 my-3 bg-slate-900 rounded-lg border border-slate-800 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <div className="truncate">
              <p className="font-semibold text-slate-200 truncate">Talleres Etxeberria</p>
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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'
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
      <div className="p-3 border-t border-slate-800 space-y-1">
        <button
          onClick={() => setActiveSection('integraciones')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeSection === 'integraciones'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Configuración</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" /> ERP
          </div>
        </button>

        <div className="pt-2 px-1">
          <button
            onClick={() => setDemoModeActive(!demoModeActive)}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              demoModeActive
                ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                : 'text-slate-500 hover:text-slate-400 bg-slate-950 border border-slate-900'
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
  );
};
