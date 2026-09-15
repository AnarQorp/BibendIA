import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  AlertCircle, 
  ArrowRight, 
  Wrench, 
  Check, 
  ChevronRight,
  Database,
  MessageSquare,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Sparkles
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

  const totalExceptionsCount = pendingQuotes.length + (noiseConv ? 1 : 0);

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
      
      {/* 1. NARRATIVE WELCOME BANNER (No traditional KPI cards grid!) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Buenos días, Jon</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mientras trabajabas, BibendIA ha atendido <strong className="text-slate-900 font-bold">7 clientes</strong> por WhatsApp y teléfono, organizado <strong className="text-slate-900 font-bold">4 citas</strong> y preparado <strong className="text-slate-900 font-bold">2 presupuestos</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveSection('bandeja')}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs"
            >
              <span>Ver Bandeja (1)</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: NECESITO QUE MIRES ESTO + HOY EN LA AGENDA */}
        <div className="lg:col-span-2 space-y-6">

          {/* 2. SECTION: NECESITO QUE MIRES ESTO (DOMINANT EXCEPTIONS) */}
          <div className="bg-white border border-amber-300/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-2xs">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>NECESITO QUE MIRES {totalExceptionsCount} {totalExceptionsCount === 1 ? 'COSA' : 'COSAS'}</span>
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Intervención humana</span>
                  </h3>
                  <p className="text-xs text-slate-500">Excepciones que requieren tu aprobación antes de enviarse o procesarse.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* Exception 1: Pending Quote approval (Ander García / Marta) */}
              {pendingQuotes.map(quote => {
                const cust = customers.find(c => c.id === quote.customerId);
                const veh = vehicles.find(v => v.id === quote.vehicleId);
                return (
                  <div key={quote.id} className="telemetry-strip-amber bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-amber-300 transition-all">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                          Presupuesto preparado
                        </span>
                        {veh && <span className="license-plate">{veh.plate}</span>}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {cust?.name || 'Ander García'} · {veh?.brand || 'BMW'} {veh?.model || '320d'}
                      </h4>
                      <p className="text-xs text-slate-600">
                        "He preparado el presupuesto de discos + pastillas traseras tras la inspección."
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-slate-500 font-medium block">Total presupuesto</span>
                        <span className="text-lg font-extrabold text-slate-900 font-mono">{quote.total.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveSection('presupuestos')}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-xl text-xs transition-all"
                        >
                          Revisar
                        </button>
                        <button
                          onClick={() => approveQuote(quote.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aprobar y enviar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Exception 2: Technical question BibendIA cannot resolve */}
              {noiseConv && (
                <div className="telemetry-strip-amber bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-amber-300 transition-all">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Consulta técnica post-reparación
                      </span>
                      <span className="license-plate">7731 CKB</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Laura Martín · Volkswagen Golf VII</h4>
                    <p className="text-xs text-slate-600">
                      Cliente reporta un silbido metálico al acelerar tras recoger el vehículo ayer.
                    </p>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={() => setActiveSection('bandeja')}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <MessageSquare className="w-4 h-4 text-blue-200" />
                      <span>Ver conversación</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. SECTION: TODO BAJO CONTROL (AUTONOMOUS RESOLVED WORK) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">TODO BAJO CONTROL</h3>
                  <p className="text-xs text-slate-500">Trabajo realizado autónomamente por BibendIA hoy.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              
              {/* Phone Call Activity Card (Marta Etxebarria) */}
              <div className="telemetry-strip-mint bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-blue-600" /> Llamada atendida
                    </span>
                    <span className="text-xs font-bold text-slate-900">Marta Etxebarria</span>
                    <span className="license-plate">8421 LMK</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Quería revisión de los 60.000 km + comprobar posible ruido al frenar.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="text-slate-500 font-normal">Resultado:</span>
                    <span>Cita concertada · Jueves 17 · 10:30</span>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> No necesitas hacer nada
                  </span>
                </div>
              </div>

              {/* WhatsApp Activity Card (Roberto López) */}
              <div className="telemetry-strip-mint bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
                    </span>
                    <span className="text-xs font-bold text-slate-900">Roberto López</span>
                    <span className="license-plate">4410 HBZ</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Preguntaba si podía pasar a recoger el vehículo tras el cambio de batería.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="text-slate-500 font-normal">Resultado:</span>
                    <span>BibendIA le ha confirmado recogida hoy desde las 17:00.</span>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> No necesitas hacer nada
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* 4. SECTION: HOY EN LA AGENDA DEL TALLER */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Hoy en la Agenda del Taller</h3>
                <p className="text-xs text-slate-500">Trabajos programados para la jornada actual.</p>
              </div>
              <button 
                onClick={() => setActiveSection('agenda')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Ver agenda completa <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {todayApps.map(app => {
                const cust = customers.find(c => c.id === app.customerId);
                const veh = vehicles.find(v => v.id === app.vehicleId);
                return (
                  <div key={app.id} className="telemetry-strip-cobalt bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-center shrink-0 font-mono">
                        <span className="text-[10px] font-bold text-slate-500 block uppercase">HORA</span>
                        <span className="text-sm font-extrabold text-blue-600">{app.time}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{app.serviceName}</h4>
                          {veh && <span className="license-plate">{veh.plate}</span>}
                        </div>
                        <p className="text-xs text-slate-600">{cust?.name} · {veh?.brand} {veh?.model}</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedAppId(app.id)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <Wrench className="w-3.5 h-3.5 text-blue-600" />
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
                  <div key={app.id} className="telemetry-strip-mint bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded uppercase">
                          TRABAJO TERMINADO
                        </span>
                        {veh && <span className="license-plate">{veh.plate}</span>}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{app.serviceName} ({cust?.name})</h4>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => notifyClientVehicleReady(app.customerId, app.vehicleId)}
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs"
                      >
                        Avisar a {cust?.name.split(' ')[0]}
                      </button>
                      {!isSentDMS ? (
                        <button
                          onClick={() => sendAppointmentToDMS(app.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>[Enviar a gestión]</span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1">
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

        {/* Right 1 Column: ACTIVIDAD HISTÓRICA / IMPACTO */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Registro de Autonomía</span>
            </h3>

            <div className="space-y-3.5 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {impactLogs.slice(0, 5).map(log => (
                <div key={log.id} className="relative pl-7 text-xs space-y-1">
                  <div className="absolute left-2 top-1.5 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-600 flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{log.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-600 leading-snug">{log.details}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveSection('impacto')}
              className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <span>Ver detalle completo de impacto</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Dictation Modal */}
      {selectedAppId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                <span>Dictar Finalización de Trabajo</span>
              </h3>
              <button onClick={() => setSelectedAppId(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleFinishWorkSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Dictado / Observaciones del Mecánico:
                </label>
                <textarea
                  value={dictationText}
                  onChange={e => setDictationText(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">BibendIA procesará automáticamente:</p>
                <p className="flex items-center gap-1.5 text-emerald-700"><Check className="w-3 h-3 text-emerald-600" /> Registro del parte de trabajo</p>
                <p className="flex items-center gap-1.5 text-emerald-700"><Check className="w-3 h-3 text-emerald-600" /> Guardado de recomendación a 6 meses</p>
                <p className="flex items-center gap-1.5 text-emerald-700"><Check className="w-3 h-3 text-emerald-600" /> Preparación para exportación a ERP</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAppId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
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

