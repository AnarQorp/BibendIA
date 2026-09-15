import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { Clock, Euro, MessageSquare, Calendar, FileText, TrendingUp, UserCheck, CheckCircle2 } from 'lucide-react';

export const ImpactoView: React.FC = () => {
  const { stats, impactLogs } = useDemo();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-2">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Lo que BibendIA ha hecho por ti</h2>
        <p className="text-xs text-slate-300">
          Resumen del trabajo de recepción, agenda, presupuestos y seguimientos asumido autónomamente por BibendIA.
        </p>
      </div>

      {/* Top 3 Big Results */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">TIEMPO AHORRADO</span>
            <span className="text-3xl font-extrabold text-orange-400 font-mono">{stats.timeSavedHoursMinutes}</span>
            <p className="text-[11px] text-slate-400">Trabajo administrativo no realizado por ti.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">GESTIONES REALIZADAS</span>
            <span className="text-3xl font-extrabold text-blue-400 font-mono">{stats.inquiriesHandled}</span>
            <p className="text-[11px] text-slate-400">Atención multicanal resuelta.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">TRABAJO RECUPERADO</span>
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">{stats.recoveredRevenue.toFixed(2)} €</span>
            <p className="text-[11px] text-slate-400">Generado gracias a seguimientos activos.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Euro className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Weekly Activity Summary */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
          Esta semana BibendIA ha...
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
            <span className="text-xl font-extrabold text-white font-mono block">{stats.appointmentsBooked}</span>
            <span className="text-[11px] font-semibold text-slate-400 block">Citas gestionadas</span>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
            <span className="text-xl font-extrabold text-white font-mono block">{stats.quotesPrepared}</span>
            <span className="text-[11px] font-semibold text-slate-400 block">Presupuestos preparados</span>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
            <span className="text-xl font-extrabold text-white font-mono block">{stats.followupsDone}</span>
            <span className="text-[11px] font-semibold text-slate-400 block">Seguimientos realizados</span>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
            <span className="text-xl font-extrabold text-white font-mono block">{stats.inquiriesHandled}</span>
            <span className="text-[11px] font-semibold text-slate-400 block">Consultas atendidas</span>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
            <span className="text-xl font-extrabold text-emerald-400 font-mono block">{stats.recoveredClients}</span>
            <span className="text-[11px] font-semibold text-slate-400 block">Clientes recuperados</span>
          </div>
        </div>
      </div>

      {/* Simple Timeline */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
          Historial de Intervenciones
        </h3>

        <div className="space-y-3">
          {impactLogs.map(log => (
            <div key={log.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-orange-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {log.timestamp}
                </span>
                <span className="font-bold text-white">{log.title}</span>
              </div>
              <span className="text-slate-400 text-[11px] hidden sm:inline">{log.details}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
