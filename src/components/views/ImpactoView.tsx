import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  Sparkles, 
  Clock, 
  Euro, 
  CheckCircle2, 
  MessageSquare, 
  Calendar, 
  FileText, 
  TrendingUp, 
  UserCheck 
} from 'lucide-react';

export const ImpactoView: React.FC = () => {
  const { stats, impactLogs } = useDemo();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Page Title & Philosophy Banner */}
      <div className="bg-gradient-to-r from-[#131b2e] via-slate-900 to-orange-950/40 border border-orange-500/30 rounded-2xl p-6 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Valor Tangible de la Suscripción
          </span>
          <span className="text-xs text-slate-400">· Talleres Etxeberria</span>
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Lo que BibendIA ha hecho por ti</h2>
        <p className="text-xs text-slate-300 max-w-2xl">
          BibendIA atiende el teléfono, responde WhatsApps, agenda citas, prepara presupuestos y hace seguimientos mientras tú estás trabajando debajo de los coches.
        </p>
      </div>

      {/* 2 Main ROI Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Highlight 1: Time Saved */}
        <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">TIEMPO ADMINISTRATIVO AHORRADO</span>
            <span className="text-3xl font-extrabold text-orange-400 font-mono">{stats.timeSavedHoursMinutes}</span>
            <p className="text-xs text-slate-400">Tiempo de oficina derivado a trabajo facturable de taller.</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
            <Clock className="w-7 h-7 stroke-[2.5]" />
          </div>
        </div>

        {/* Highlight 2: Revenue Generated */}
        <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">TRABAJO / INGRESOS RECUPERADOS</span>
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">{stats.revenueRecovered.toFixed(2)} €</span>
            <p className="text-xs text-slate-400">Generados vía seguimiento automático y aceptación de presupuestos.</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Euro className="w-7 h-7 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* 6 Key Operational Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 text-center space-y-1">
          <MessageSquare className="w-5 h-5 text-blue-400 mx-auto" />
          <span className="text-2xl font-extrabold text-white font-mono block">{stats.inquiriesHandled}</span>
          <span className="text-[11px] font-semibold text-slate-400 block">Consultas Atendidas</span>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 text-center space-y-1">
          <Calendar className="w-5 h-5 text-orange-400 mx-auto" />
          <span className="text-2xl font-extrabold text-white font-mono block">{stats.appointmentsBooked}</span>
          <span className="text-[11px] font-semibold text-slate-400 block">Citas Gestionadas</span>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 text-center space-y-1">
          <FileText className="w-5 h-5 text-amber-400 mx-auto" />
          <span className="text-2xl font-extrabold text-white font-mono block">{stats.quotesPrepared}</span>
          <span className="text-[11px] font-semibold text-slate-400 block">Presupuestos Preparados</span>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 text-center space-y-1">
          <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto" />
          <span className="text-2xl font-extrabold text-white font-mono block">{stats.followupsDone}</span>
          <span className="text-[11px] font-semibold text-slate-400 block">Seguimientos Realizados</span>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 text-center space-y-1">
          <UserCheck className="w-5 h-5 text-purple-400 mx-auto" />
          <span className="text-2xl font-extrabold text-white font-mono block">{stats.recoveredClients}</span>
          <span className="text-[11px] font-semibold text-slate-400 block">Clientes Recuperados</span>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 text-center space-y-1">
          <CheckCircle2 className="w-5 h-5 text-teal-400 mx-auto" />
          <span className="text-2xl font-extrabold text-emerald-400 font-mono block">100%</span>
          <span className="text-[11px] font-semibold text-slate-400 block">Autonomía Recepción</span>
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <span>Historial Cronológico de Acciones de Recepción</span>
        </h3>

        <div className="space-y-3">
          {impactLogs.map(log => (
            <div 
              key={log.id} 
              className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="bg-slate-800 p-2 rounded-lg text-xs font-mono font-bold text-slate-300 shrink-0">
                  {log.timestamp}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white">{log.title}</h4>
                  <p className="text-xs text-slate-400">{log.details}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                  +{log.timeSavedMinutes} min ahorrados
                </span>
                {log.revenueImpact && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                    +{log.revenueImpact.toFixed(2)} €
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
