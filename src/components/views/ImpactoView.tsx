import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { Clock, Euro, MessageSquare, Calendar, FileText, TrendingUp, UserCheck, CheckCircle2, Sparkles } from 'lucide-react';

export const ImpactoView: React.FC = () => {
  const { stats, impactLogs } = useDemo();

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Lo que BibendIA ha hecho por ti</h2>
        </div>
        <p className="text-xs text-slate-500">
          Resumen del trabajo de recepción, agenda, presupuestos y seguimientos asumido autónomamente por BibendIA.
        </p>
      </div>

      {/* Top 3 Big Results (Clean 2C Light Metric Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">TIEMPO AHORRADO</span>
            <span className="text-3xl font-extrabold text-slate-900 font-mono">{stats.timeSavedHoursMinutes}</span>
            <p className="text-xs text-slate-500">Trabajo administrativo no realizado por ti.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">GESTIONES REALIZADAS</span>
            <span className="text-3xl font-extrabold text-blue-600 font-mono">{stats.inquiriesHandled}</span>
            <p className="text-xs text-slate-500">Atención multicanal resuelta.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">TRABAJO RECUPERADO</span>
            <span className="text-3xl font-extrabold text-emerald-700 font-mono">{stats.recoveredRevenue.toFixed(2)} €</span>
            <p className="text-xs text-slate-500">Generado gracias a seguimientos activos.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <Euro className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Weekly Activity Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
          Esta semana BibendIA ha...
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
            <span className="text-2xl font-extrabold text-slate-900 font-mono block">{stats.appointmentsBooked}</span>
            <span className="text-xs font-semibold text-slate-600 block">Citas gestionadas</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
            <span className="text-2xl font-extrabold text-slate-900 font-mono block">{stats.quotesPrepared}</span>
            <span className="text-xs font-semibold text-slate-600 block">Presupuestos preparados</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
            <span className="text-2xl font-extrabold text-slate-900 font-mono block">{stats.followupsDone}</span>
            <span className="text-xs font-semibold text-slate-600 block">Seguimientos realizados</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
            <span className="text-2xl font-extrabold text-slate-900 font-mono block">{stats.inquiriesHandled}</span>
            <span className="text-xs font-semibold text-slate-600 block">Consultas atendidas</span>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
            <span className="text-2xl font-extrabold text-emerald-800 font-mono block">{stats.recoveredClients}</span>
            <span className="text-xs font-bold text-emerald-800 block">Clientes recuperados</span>
          </div>
        </div>
      </div>

      {/* Intervention History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Historial de Intervenciones</span>
        </h3>

        <div className="space-y-3">
          {impactLogs.map(log => (
            <div key={log.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-blue-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                  {log.timestamp}
                </span>
                <span className="font-bold text-slate-900">{log.title}</span>
              </div>
              <span className="text-slate-600 text-xs hidden sm:inline">{log.details}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

