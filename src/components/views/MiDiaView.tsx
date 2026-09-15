import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  Wrench, 
  Send, 
  Calendar,
  Check,
  ChevronRight,
  Database
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
    confirmMartaAppointment,
    vehicles,
    customers
  } = useDemo();

  // State for mechanic dictation modal
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [dictationText, setDictationText] = useState('Aceite 5W30 C3 y filtro de aceite sustituidos. Pastillas con buen grosor, pero discos delanteros presentan desgaste. Recomendar cambio en 6 meses.');

  const pendingQuotes = quotes.filter(q => q.status === 'pending_approval');
  const todayApps = appointments.filter(a => a.status !== 'completed' && a.status !== 'sent_to_dms');
  const completedApps = appointments.filter(a => a.status === 'completed' || a.status === 'sent_to_dms');

  const handleFinishWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAppId) {
      completeAppointmentWork(
        selectedAppId,
        dictationText,
        'Recomendar cambio de discos y pastillas delanteras en 6 meses (marzo 2027).'
      );
      setSelectedAppId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#131b2e] via-slate-900 to-[#131b2e] border border-orange-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-orange-400 uppercase tracking-wider bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
                Recepción Autónoma Activa
              </span>
              <span className="text-xs text-slate-400">· Talleres Etxeberria</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Buenos días, Jon</h2>
            <p className="text-sm text-slate-300 mt-1">
              Mientras estabas trabajando en el taller: <span className="font-semibold text-emerald-400">5 consultas atendidas</span> · <span className="font-semibold text-blue-400">3 citas gestionadas</span> · <span className="font-semibold text-amber-400">2 presupuestos preparados</span>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveSection('bandeja')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <span>Ver Bandeja (1)</span>
              <ArrowRight className="w-4 h-4 text-orange-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Action Required + Today's Schedule */}
        <div className="lg:col-span-2 space-y-6">

          {/* SECTION: NECESITA TU ATENCIÓN */}
          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Necesita Tu Atención</h3>
              </div>
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                {pendingQuotes.length} pendientes
              </span>
            </div>

            {pendingQuotes.length === 0 ? (
              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                ¡Todo al día! La IA ha procesado todas las solicitudes de recepción.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingQuotes.map(quote => {
                  const customer = customers.find(c => c.id === quote.customerId);
                  const vehicle = vehicles.find(v => v.id === quote.vehicleId);
                  return (
                    <div 
                      key={quote.id} 
                      className="p-4 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
                            Presupuesto preparado por IA
                          </span>
                          {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                          <span className="text-xs text-slate-400">{quote.createdDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white">{quote.title}</h4>
                        <p className="text-xs text-slate-300">
                          Cliente: <span className="font-semibold text-slate-200">{customer?.name}</span> · {vehicle?.brand} {vehicle?.model}
                        </p>
                        <p className="text-[11px] text-slate-400 italic">"{quote.aiRationale}"</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">TOTAL IVA INC.</p>
                          <p className="text-lg font-extrabold text-amber-400">{quote.total.toFixed(2)} €</p>
                        </div>
                        <button
                          onClick={() => approveQuote(quote.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all hover:scale-[1.02]"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Aprobar y enviar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION: HOY EN LA AGENDA */}
          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Hoy en la Agenda</h3>
              </div>
              <button 
                onClick={() => setActiveSection('agenda')}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Ver agenda completa <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {todayApps.map(app => {
                const customer = customers.find(c => c.id === app.customerId);
                const vehicle = vehicles.find(v => v.id === app.vehicleId);
                return (
                  <div 
                    key={app.id}
                    className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-slate-800 px-3 py-2 rounded-lg text-center shrink-0">
                        <span className="text-xs font-bold text-slate-400 block uppercase">HORA</span>
                        <span className="text-sm font-extrabold text-orange-400">{app.time}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{app.serviceName}</h4>
                          {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                        </div>
                        <p className="text-xs text-slate-300">
                          {customer?.name} · {vehicle?.brand} {vehicle?.model} ({vehicle?.motorization})
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> {app.estimatedDurationMinutes} min estim.</span>
                          <span>Mecánico: <strong className="text-slate-300">{app.assignedMechanic || 'Jon'}</strong></span>
                        </div>
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

              {/* Completed items section */}
              {completedApps.map(app => {
                const customer = customers.find(c => c.id === app.customerId);
                const vehicle = vehicles.find(v => v.id === app.vehicleId);
                const isSentDMS = app.status === 'sent_to_dms';
                return (
                  <div key={app.id} className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-lg shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-400 uppercase">TRABAJO TERMINADO</span>
                          {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                        </div>
                        <h4 className="text-sm font-bold text-white">{app.serviceName} ({customer?.name})</h4>
                        {app.completedNotes && (
                          <p className="text-xs text-slate-300 mt-1 italic">"{app.completedNotes}"</p>
                        )}
                        {app.futureRecommendation && (
                          <p className="text-[11px] text-amber-300 font-semibold mt-0.5">
                            Recomendación futura guardada: {app.futureRecommendation}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {!isSentDMS ? (
                        <button
                          onClick={() => sendAppointmentToDMS(app.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>[Enviar a gestión]</span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-900/60 border border-emerald-700/60 px-3 py-1.5 rounded-xl flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Enviado a ERP / DMS
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Column: HECHO POR LA IA */}
        <div className="space-y-6">
          <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Hecho por la IA</h3>
              </div>
              <span className="text-[11px] text-slate-400">Hoy</span>
            </div>

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
                  {log.revenueImpact && (
                    <span className="inline-block text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded mt-0.5">
                      +{log.revenueImpact.toFixed(2)} € generado
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveSection('impacto')}
              className="w-full mt-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-orange-400 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <span>Ver todas las acciones e impacto</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dictation Modal for Mechanics */}
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
                  Dictado / Notas del Mecánico:
                </label>
                <textarea
                  value={dictationText}
                  onChange={e => setDictationText(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <p className="font-bold text-orange-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> BibendIA procesará automáticamente:
                </p>
                <p>✓ Registro de trabajos realizados</p>
                <p>✓ Guardado de recomendación preventiva futura</p>
                <p>✓ Programación de seguimiento preventivo</p>
                <p>✓ Preparación de datos para facturación en 1 clic</p>
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
