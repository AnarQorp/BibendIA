import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  Wrench, 
  Check, 
  ChevronRight,
  Database,
  MessageSquare,
  FileText,
  AlertTriangle
} from 'lucide-react';

export const MiDiaView: React.FC = () => {
  const { 
    quotes, 
    approveQuote, 
    appointments, 
    completeAppointmentWork, 
    sendAppointmentToDMS, 
    impactLogs,
    setActiveSection,
    vehicles,
    customers,
    notifyClientVehicleReady,
    conversations
  } = useDemo();

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [dictationText, setDictationText] = useState('Aceite 5W30 C3 y filtro de aceite sustituidos. Pastillas con buen grosor, discos delanteros presentan desgaste leve.');

  const pendingQuotes = quotes.filter(q => q.status === 'pending_approval');
  const todayApps = appointments.filter(a => a.status !== 'completed' && a.status !== 'sent_to_dms');
  const completedApps = appointments.filter(a => a.status === 'completed' || a.status === 'sent_to_dms');

  const noiseConv = conversations.find(c => c.id === 'conv-noise-issue');

  const handleFinishWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAppId) {
      completeAppointmentWork(
        selectedAppId,
        dictationText,
        'Sustituir discos y pastillas delanteras en la revisión de los 6 meses (marzo 2027).'
      );
      setSelectedAppId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Buenos días, Jon</h2>
            <p className="text-sm text-slate-300 mt-1">
              Mientras trabajabas, BibendIA se ha ocupado de: <strong className="text-emerald-400">5 consultas</strong> · <strong className="text-blue-400">3 citas</strong> · <strong className="text-amber-400">2 presupuestos</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveSection('bandeja')}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <span>Ver Bandeja (1)</span>
              <ArrowRight className="w-4 h-4 text-orange-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: NECESITO QUE MIRES ESTO + HOY EN LA AGENDA */}
        <div className="lg:col-span-2 space-y-6">

          {/* SECTION: NECESITO QUE MIRES ESTO (The 20% of Exceptions) */}
          <div className="bg-[#131b2e] border border-amber-500/30 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">NECESITO QUE MIRES ESTO</h3>
                  <p className="text-[11px] text-slate-400">BibendIA resuelve el 80%. Aquí aparece únicamente el 20% que necesita a Jon.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* Exception 1: Presupuesto pendiente de aprobación */}
              {pendingQuotes.map(quote => {
                const cust = customers.find(c => c.id === quote.customerId);
                const veh = vehicles.find(v => v.id === quote.vehicleId);
                return (
                  <div key={quote.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                          Presupuesto preparado
                        </span>
                        {veh && <span className="license-plate">{veh.plate}</span>}
                      </div>
                      <h4 className="text-sm font-bold text-white">{quote.title}</h4>
                      <p className="text-xs text-slate-300">Cliente: <strong className="text-slate-100">{cust?.name}</strong> · {veh?.brand} {veh?.model}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-lg font-extrabold text-amber-400 block">{quote.total.toFixed(2)} €</span>
                      </div>
                      <button
                        onClick={() => approveQuote(quote.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                      >
                        <Check className="w-4 h-4" />
                        <span>Aprobar y enviar</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Exception 2: Technical question BibendIA cannot answer */}
              {noiseConv && (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Consulta técnica post-reparación
                      </span>
                      <span className="license-plate">7731 CKB</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">Laura Martín — Ruido metálico al acelerar</h4>
                    <p className="text-xs text-slate-300">Cliente reporta un silbido extraño tras recoger el Golf ayer.</p>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={() => setActiveSection('bandeja')}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-4 h-4 text-orange-400" />
                      <span>Ver conversación</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION: HOY EN LA AGENDA */}
          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Hoy en la Agenda del Taller</h3>
              <button 
                onClick={() => setActiveSection('agenda')}
                className="text-xs font-semibold text-orange-400 hover:underline flex items-center gap-1"
              >
                Ver agenda completa <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {todayApps.map(app => {
                const cust = customers.find(c => c.id === app.customerId);
                const veh = vehicles.find(v => v.id === app.vehicleId);
                return (
                  <div key={app.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-slate-950 px-3 py-2 rounded-lg text-center shrink-0 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">HORA</span>
                        <span className="text-sm font-extrabold text-orange-400">{app.time}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{app.serviceName}</h4>
                          {veh && <span className="license-plate">{veh.plate}</span>}
                        </div>
                        <p className="text-xs text-slate-300">{cust?.name} · {veh?.brand} {veh?.model}</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedAppId(app.id)}
                        className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Dictar finalización trabajo</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {completedApps.map(app => {
                const cust = customers.find(c => c.id === app.customerId);
                const veh = vehicles.find(v => v.id === app.vehicleId);
                const isSentDMS = app.status === 'sent_to_dms';
                return (
                  <div key={app.id} className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-400 uppercase">TRABAJO TERMINADO</span>
                        {veh && <span className="license-plate">{veh.plate}</span>}
                      </div>
                      <h4 className="text-sm font-bold text-white">{app.serviceName} ({cust?.name})</h4>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => notifyClientVehicleReady(app.customerId, app.vehicleId)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold"
                      >
                        Avisar a {cust?.name.split(' ')[0]}
                      </button>
                      {!isSentDMS ? (
                        <button
                          onClick={() => sendAppointmentToDMS(app.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>[Enviar a gestión]</span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-700/60 px-3 py-1.5 rounded-xl flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Enviado a ERP
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Column: ACTIVIDAD REALIZADA POR BIBENDIA */}
        <div className="space-y-6">
          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              Actividad Resuelta por BibendIA
            </h3>

            <div className="space-y-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
              {impactLogs.slice(0, 5).map(log => (
                <div key={log.id} className="relative pl-7 text-xs space-y-0.5">
                  <div className="absolute left-2 top-1.5 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{log.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-400 leading-snug">{log.details}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveSection('impacto')}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-orange-400 font-bold rounded-xl flex items-center justify-center gap-1.5"
            >
              <span>Ver impacto de gestión</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dictation Modal */}
      {selectedAppId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-slate-700 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-orange-400" />
                <span>Dictar Finalización de Trabajo</span>
              </h3>
              <button onClick={() => setSelectedAppId(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleFinishWorkSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Dictado / Observaciones del Mecánico:
                </label>
                <textarea
                  value={dictationText}
                  onChange={e => setDictationText(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <p className="font-bold text-orange-400">BibendIA procesará automáticamente:</p>
                <p>✓ Registro del parte de trabajo</p>
                <p>✓ Guardado de recomendación a 6 meses</p>
                <p>✓ Preparación para exportación a gestión</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAppId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Procesar y Finalizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
