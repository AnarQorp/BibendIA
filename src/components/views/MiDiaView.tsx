import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { useWorkshopAppointments } from '../../context/WorkshopAppointmentsContext';
import { useRouter } from '../../router/RouterContext';
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
  Sparkles,
  Lock,
  Clock,
  RotateCcw
} from 'lucide-react';
import { formatAppointmentTime } from '../../services/workshopAppointments';

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
    conversations,
    demoModeActive
  } = useDemo();

  const {
    appointments: realAppointments,
    todayAppointments: realTodayAppointments,
    provisionalAppointments: realProvisionalAppointments,
    state: appointmentState,
    refresh: refreshRealAppointments
  } = useWorkshopAppointments();

  const { navigate } = useRouter();
  const goTo = (section: any, path: string) => {
    setActiveSection(section);
    navigate(path);
  };

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [dictationText, setDictationText] = useState('Aceite 5W30 C3 y filtro de aceite sustituidos. Pastillas con buen grosor, discos delanteros presentan desgaste leve.');

  // -------------------------------------------------------------
  // PRODUCT MODE: Real Backend Data Derived Operations
  // -------------------------------------------------------------
  if (!demoModeActive) {
    // State 1: Awaiting Tenant Resolution
    if (appointmentState.status === 'awaiting_tenant') {
      return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 stroke-[1.75]" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-extrabold text-slate-900">Sesión de Taller Requerida</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Para consultar las citas y la jornada de Mi Día, inicia sesión con un usuario autorizado en el taller.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // State 2: Loading State
    if (appointmentState.status === 'loading') {
      return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold text-slate-600">Consultando jornada y citas programadas del taller...</p>
          </div>
        </div>
      );
    }

    // State 3: Unauthorized (401 / 403)
    if (appointmentState.status === 'unauthorized') {
      return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
          <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900">Acceso no autorizado</h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  {appointmentState.message || 'Tu usuario no dispone de permisos activos para este taller. Inicia sesión con la cuenta correspondiente.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // State 4: Error State (Explicit, with correlationId and retry)
    if (appointmentState.status === 'error') {
      return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Error de Conexión al Sincronizar Mi Día</span>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">{appointmentState.message}</p>
            {appointmentState.correlationId && (
              <p className="text-[11px] font-mono text-rose-600">ID Correlación: {appointmentState.correlationId}</p>
            )}
            <div className="pt-1">
              <button
                onClick={refreshRealAppointments}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      );
    }

    // States 5 & 6: Empty or Success (Demonstrably healthy response from backend)
    const hasProvisional = realProvisionalAppointments.length > 0;
    const exceptionsCount = realProvisionalAppointments.length;

    return (
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
        {/* 1. NARRATIVE WELCOME BANNER */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1 max-w-3xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Buenos días</h2>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">Modo Productivo</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Agenda actualizada. Hay <strong className="text-slate-900 font-bold">{realAppointments.length} {realAppointments.length === 1 ? 'cita confirmada' : 'citas confirmadas'}</strong> en el taller ({realTodayAppointments.length} programadas para hoy).
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => goTo('agenda', '/agenda')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs"
              >
                <span>Ver Agenda ({realAppointments.length})</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Grid Layout: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">

            {/* 2. SECTION: NECESITO QUE MIRES ESTO (Excepciones derivadas de citas reales) */}
            <div className="bg-white border border-amber-300/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-2xs">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      <span>NECESITO QUE MIRES {exceptionsCount} {exceptionsCount === 1 ? 'COSA' : 'COSAS'}</span>
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Revisión de Taller</span>
                    </h3>
                    <p className="text-xs text-slate-500">Excepciones e identidades provisionales que requieren verificación presencial.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                {hasProvisional ? (
                  realProvisionalAppointments.map(app => (
                    <div key={app.id} className="telemetry-strip-amber bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-300 transition-all">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            {app.identity_resolution === 'provisional_ambiguous'
                              ? 'Identidad Ambigua (Requiere revisión)'
                              : 'Identidad Provisional (Nueva)'}
                          </span>
                          <span className="license-plate">{app.vehicle_plate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {app.customer_name} · {app.service_request?.intent || 'Intervención de Taller'}
                        </h4>
                        <p className="text-xs text-slate-600">
                          Cita capturada por BibendIA con resolución provisional. Requiere confirmación presencial de matrícula y titular.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => goTo('agenda', '/agenda')}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <span>Revisar en Agenda</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-200/60 rounded-xl text-slate-600 text-xs text-center space-y-1">
                    <p className="font-bold text-slate-800">Todo al día</p>
                    <p className="text-slate-500">No hay citas con identidad provisional ni excepciones pendientes de revisión humana.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. SECTION: HOY EN LA AGENDA DEL TALLER */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Hoy en la Agenda del Taller</h3>
                  <p className="text-xs text-slate-500">Citas programadas para la jornada actual.</p>
                </div>
                <button
                  onClick={() => goTo('agenda', '/agenda')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Ver agenda completa <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {realTodayAppointments.length > 0 ? (
                  realTodayAppointments.map(app => (
                    <div key={app.id} className="telemetry-strip-cobalt bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-center shrink-0 font-mono">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">HORA</span>
                          <span className="text-sm font-extrabold text-blue-600">
                            {formatAppointmentTime(app.start_at, app.end_at)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{app.service_request?.intent || 'Intervención'}</h4>
                            <span className="license-plate">{app.vehicle_plate}</span>
                          </div>
                          <p className="text-xs text-slate-600">{app.customer_name}</p>
                          {app.service_request?.symptoms && app.service_request.symptoms.length > 0 && (
                            <p className="text-[11px] text-slate-500">Síntomas: {app.service_request.symptoms.join(', ')}</p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className="text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 bg-blue-50 text-blue-800 border-blue-200">
                          <Check className="w-3.5 h-3.5" />
                          {app.status === 'booked' ? 'Cita Reservada' : app.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : realAppointments.length > 0 ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs space-y-2">
                    <p>No hay citas programadas para el día de hoy.</p>
                    <p className="text-[11px] text-slate-400">Hay {realAppointments.length} {realAppointments.length === 1 ? 'cita programada' : 'citas programadas'} en la agenda para próximas fechas.</p>
                    <button
                      onClick={() => goTo('agenda', '/agenda')}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs"
                    >
                      Consultar Agenda
                    </button>
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                    Sin citas registradas en el taller para la jornada de hoy.
                  </div>
                )}
              </div>
            </div>

            {/* 4. SECTION: TODO BAJO CONTROL */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight">TODO BAJO CONTROL</h3>
                    <p className="text-xs text-slate-500">Citas gestionadas autónomamente por el motor de BibendIA.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                {realAppointments.length > 0 ? (
                  realAppointments.map(app => (
                    <div key={app.id} className="telemetry-strip-mint bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cita Adquirida
                          </span>
                          <span className="text-xs font-bold text-slate-900">{app.service_request?.intent || 'Intervención de Taller'}</span>
                          <span className="license-plate">{app.vehicle_plate}</span>
                        </div>
                        <p className="text-xs text-slate-600">Cliente: {app.customer_name} · Ref: {app.confirmation_evidence_ref}</p>
                      </div>
                      <div className="shrink-0">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Confirmada en Agenda
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 bg-slate-50 border border-slate-200/60 rounded-xl text-slate-500 text-xs">
                    Sin citas registradas aún. Integración de voz preparada · pendiente de activación productiva y smoke real.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right 1 Column: Fronteras de Producto no implementadas en Backend */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Estado del Módulo Taller</span>
              </h3>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
                <p className="font-bold text-slate-900">Capacidades Activas:</p>
                <p className="flex items-center gap-1.5 text-emerald-700"><Check className="w-3 h-3 text-emerald-600" /> Gestión de huecos y citas en Agenda</p>
                <p className="flex items-center gap-1.5 text-emerald-700"><Check className="w-3 h-3 text-emerald-600" /> Protección PII y descifrado verificado</p>
                <p className="flex items-center gap-1.5 text-emerald-700"><Check className="w-3 h-3 text-emerald-600" /> Sincronización en tiempo real</p>
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                <p className="font-bold text-amber-950">Fronteras en Preparación:</p>
                <p className="flex items-center gap-1.5 text-amber-900 font-semibold pt-0.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Voz IA (Twilio / ElevenLabs): integración preparada · pendiente de activación productiva y smoke real
                </p>
                <p className="text-[11px] leading-relaxed text-amber-900/80">
                  Los módulos de voz interactiva, presupuestación automática contra catálogo y la bandeja de mensajes están en preparación técnica para su activación operativa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEMO MODE: Rich Interactive Pitch (Preserved)
  // -------------------------------------------------------------
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
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      
      {/* 1. NARRATIVE WELCOME BANNER (No traditional KPI cards grid!) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Buenos días, Jon</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mientras trabajabas, BibendIA ha atendido <strong className="text-slate-900 font-bold">7 clientes</strong> por WhatsApp y teléfono, organizado <strong className="text-slate-900 font-bold">4 citas</strong> y preparado <strong className="text-slate-900 font-bold">2 presupuestos</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => goTo('bandeja', '/bandeja')}
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
                  <div key={quote.id} className="telemetry-strip-amber bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-300 transition-all">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                          Presupuesto preparado
                        </span>
                        {veh && <span className="license-plate">{veh.plate}</span>}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {cust?.name || 'Cliente'} · {veh?.brand || 'Vehículo'} {veh?.model || ''}
                      </h4>
                      <p className="text-xs text-slate-600">
                        "He preparado el presupuesto de recambios y mano de obra tras la inspección."
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-slate-500 font-medium block">Total presupuesto</span>
                        <span className="text-lg font-extrabold text-slate-900 font-mono">
                          {quote.total !== null ? `${quote.total.toFixed(2)} €` : 'Precio pendiente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => goTo('presupuestos', '/presupuestos')}
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
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Consulta entrante requiere atención técnica</h4>
                    <p className="text-xs text-slate-600">
                      Cliente reporta incidencia post-servicio que requiere valoración por el jefe de taller.
                    </p>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={() => goTo('bandeja', '/bandeja')}
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
              {impactLogs.length > 0 ? (
                impactLogs.map(log => (
                  <div key={log.id} className="telemetry-strip-mint bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {log.category === 'booking' ? 'Cita' : log.category === 'quote' ? 'Presupuesto' : 'Intervención'}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{log.title}</span>
                      </div>
                      <p className="text-xs text-slate-600">{log.details}</p>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <span className="text-slate-500 font-normal">Ahorro estimado:</span>
                        <span>{log.timeSavedMinutes} min</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> No necesitas hacer nada
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 bg-slate-50 border border-slate-200/60 rounded-xl text-slate-500 text-xs">
                  Sin intervenciones automáticas registradas durante la jornada de hoy.
                </div>
              )}
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
                onClick={() => goTo('agenda', '/agenda')}
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
                  <div key={app.id} className="telemetry-strip-cobalt bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

                    <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setSelectedAppId(app.id)}
                        className="w-full sm:w-auto bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
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
                  <div key={app.id} className="telemetry-strip-mint bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded uppercase">
                          TRABAJO TERMINADO
                        </span>
                        {veh && <span className="license-plate">{veh.plate}</span>}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{app.serviceName} ({cust?.name})</h4>
                    </div>

                    <div className="shrink-0 flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => notifyClientVehicleReady(app.customerId, app.vehicleId)}
                        className="flex-1 sm:flex-none bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs text-center"
                      >
                        Avisar a {cust?.name.split(' ')[0]}
                      </button>
                      {!isSentDMS ? (
                        <button
                          onClick={() => sendAppointmentToDMS(app.id)}
                          className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>Enviar a ERP</span>
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
              onClick={() => goTo('impacto', '/impacto')}
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

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAppId(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 min-h-[44px] flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm min-h-[44px] flex items-center justify-center"
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

