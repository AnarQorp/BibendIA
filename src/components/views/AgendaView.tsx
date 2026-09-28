import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { useWorkshopAppointments } from '../../context/WorkshopAppointmentsContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Check,
  User,
  Car,
  Wrench,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Lock,
  RotateCcw,
  ShieldCheck,
  FileText
} from 'lucide-react';
import {
  formatAppointmentDate,
  formatAppointmentTime,
  isProvisionalIdentity,
  type WorkshopAppointmentsState
} from '../../services/workshopAppointments';

export interface AgendaViewProps {
  // Authorized tenant identifier derived from session principal; null when awaiting auth integration
  tenantId?: string | null;
}

export const AgendaView: React.FC<AgendaViewProps> = ({ tenantId: propTenantId }) => {
  const {
    appointments: demoAppointments,
    customers: demoCustomers,
    vehicles: demoVehicles,
    confirmAppointmentSlot,
    demoModeActive
  } = useDemo();

  const workshopContext = useWorkshopAppointments();
  const tenantId = propTenantId ?? workshopContext.tenantId;
  const realState = workshopContext.state;
  const realAppointments = workshopContext.appointments;
  const refreshRealAppointments = workshopContext.refresh;

  // Selected Day & View Mode for Calendar
  const [selectedDay, setSelectedDay] = useState<string>('2026-09-17');
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [productViewMode, setProductViewMode] = useState<'list' | 'week'>('list');

  const daysOfWeek = [
    { date: '2026-09-15', label: 'Mar 15', full: 'Martes 15' },
    { date: '2026-09-16', label: 'Mié 16', full: 'Miércoles 16' },
    { date: '2026-09-17', label: 'Jue 17', full: 'Jueves 17' },
    { date: '2026-09-18', label: 'Vie 18', full: 'Viernes 18' },
    { date: '2026-09-19', label: 'Sáb 19', full: 'Sábado 19' },
  ];

  // -------------------------------------------------------------
  // PRODUCT MODE: Real Backend Contract Execution (No invented tenant)
  // -------------------------------------------------------------
  if (!demoModeActive) {
    return (
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">

        {/* Real Product Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" /> Agenda Productiva
              </span>
              <span className="text-xs text-slate-500 font-mono">
                GET /v1/workshop/tenants/:tenantId/appointments
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Citas del Taller</h1>
            <p className="text-xs text-slate-500">
              Datos obtenidos directamente del Core de BibendIA mediante sesión autenticada con descifrado legítimo de PII.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {realState.status === 'success' && realAppointments.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  onClick={() => setProductViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    productViewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setProductViewMode('week')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    productViewMode === 'week'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Calendario
                </button>
              </div>
            )}

            {tenantId && (
              <button
                onClick={refreshRealAppointments}
                disabled={realState.status === 'loading'}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${realState.status === 'loading' ? 'animate-spin' : ''}`} />
                <span>Sincronizar</span>
              </button>
            )}
          </div>
        </div>

        {/* State 0: Awaiting Session / Tenant Authority (No hardcoded ID) */}
        {(!tenantId || realState.status === 'awaiting_tenant') && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 stroke-[1.75]" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-extrabold text-slate-900">Contexto de Taller Pendiente de Sesión</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Para consultar citas, se requiere una sesión activa con membresía en un taller. De acuerdo con el modelo de seguridad P0.2 / P0.3, el identificador del taller se deriva de forma segura en el servidor y no puede ser manipulado en el cliente.
              </p>
            </div>
          </div>
        )}

        {/* State 1: Loading */}
        {tenantId && realState.status === 'loading' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold text-slate-600">Consultando agenda contra el contrato real...</p>
          </div>
        )}

        {/* State 2: Unauthorized (Session / Membership required) */}
        {tenantId && realState.status === 'unauthorized' && (
          <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900">Autenticación de Taller Requerida</h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  {realState.message}
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 mt-2">
                  <p className="font-bold text-slate-800">Invariante de Seguridad P0.2 / P0.3:</p>
                  <p className="text-[11px] text-slate-500 pt-0.5">
                    El backend rechaza peticiones anónimas o con `x-tenant-id` manipulado. El frontend no inventa tokens ni simula estar conectado mientras el flujo OIDC esté en integración.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 3: Error */}
        {tenantId && realState.status === 'error' && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Error de Conexión con el Backend</span>
            </div>
            <p className="text-xs text-rose-700">{realState.message}</p>
            {realState.correlationId && (
              <p className="text-[11px] font-mono text-rose-600">ID Correlación: {realState.correlationId}</p>
            )}
            <div className="pt-2">
              <button
                onClick={refreshRealAppointments}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* State 4: Empty (No appointments yet) */}
        {tenantId && realState.status === 'empty' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
              <CalendarIcon className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No hay citas registradas en este taller</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Cuando el agente de voz o la recepción capturen una cita confirmada, aparecerá aquí con los datos del vehículo y cliente desvelados.
            </p>
          </div>
        )}

        {/* State 5: Success (Real Appointments rendered with Rich Representation) */}
        {tenantId && realState.status === 'success' && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Citas Confirmadas en el Taller ({realAppointments.length})
                </h3>
              </div>
              {realState.correlationId && (
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  Ref: {realState.correlationId}
                </span>
              )}
            </div>

            {/* List View */}
            {productViewMode === 'list' && (
              <div className="space-y-3">
                {realAppointments.map(app => {
                  const isProvisional = isProvisionalIdentity(app);

                  return (
                    <div
                      key={app.id}
                      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 transition-all ${
                        isProvisional ? 'border-amber-300 ring-1 ring-amber-300/40' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-center shrink-0 font-mono">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">HORARIO</span>
                            <span className="text-sm font-extrabold text-blue-600">
                              {formatAppointmentTime(app.start_at, app.end_at)}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 capitalize block">
                              {formatAppointmentDate(app.start_at)}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <h4 className="text-sm font-bold text-slate-900">
                                {app.service_request?.intent || 'Intervención de Taller'}
                              </h4>
                              <span className="license-plate">{app.vehicle_plate}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Identity resolution badge */}
                          {isProvisional ? (
                            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Identidad Provisional (Revisar)
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Identidad Verificada
                            </span>
                          )}

                          {/* Status badge */}
                          <span className="text-xs font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 bg-blue-50 text-blue-800 border-blue-200">
                            <Check className="w-3.5 h-3.5" />
                            {app.status === 'booked' ? 'Cita Reservada' : app.status}
                          </span>
                        </div>
                      </div>

                      {/* Detail row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <p className="text-slate-600">
                            Cliente: <strong className="text-slate-900 font-bold">{app.customer_name}</strong>
                          </p>
                          {app.service_request?.symptoms && app.service_request.symptoms.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              <span className="text-slate-500 font-medium">Síntomas:</span>
                              {app.service_request.symptoms.map((s, idx) => (
                                <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          {app.service_request?.notes && (
                            <p className="text-slate-500 italic pt-0.5">
                              Nota: {app.service_request.notes}
                            </p>
                          )}
                        </div>

                        <div className="sm:text-right space-y-1 font-mono text-[11px] text-slate-400">
                          <p>Caso: {app.case_id.slice(0, 8)}...{app.case_id.slice(-4)}</p>
                          <p className="truncate">Evidencia: {app.confirmation_evidence_ref}</p>
                          <p>Versión: v{app.version}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Weekly Calendar Representation */}
            {productViewMode === 'week' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    <span>Distribución de Citas Reales en Calendario</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">
                    {realAppointments.length} citas programadas
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {daysOfWeek.map(d => {
                    const dayApps = realAppointments.filter(a => a.start_at.startsWith(d.date));

                    return (
                      <div
                        key={d.date}
                        className="bg-slate-50/60 border border-slate-200 rounded-xl p-3 space-y-2 min-h-[140px]"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                          <span className="text-xs font-bold text-slate-800">{d.full}</span>
                          <span className="text-[11px] font-bold text-blue-600 font-mono">{dayApps.length}</span>
                        </div>

                        <div className="space-y-2">
                          {dayApps.map(app => (
                            <div key={app.id} className="p-2 bg-white border border-slate-200 rounded-lg text-xs space-y-1 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-blue-600 font-mono text-[11px]">
                                  {new Date(app.start_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="license-plate">{app.vehicle_plate}</span>
                              </div>
                              <p className="font-bold text-slate-900 truncate text-[11px]">
                                {app.service_request?.intent || 'Intervención'}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{app.customer_name}</p>
                              {isProvisionalIdentity(app) && (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded block truncate">
                                  Provisional
                                </span>
                              )}
                            </div>
                          ))}

                          {dayApps.length === 0 && (
                            <div className="h-20 flex items-center justify-center text-[11px] text-slate-400 text-center border border-dashed border-slate-200 rounded-lg">
                              Sin citas este día
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    );
  }

  // -------------------------------------------------------------
  // DEMO MODE: Rich Interactive Pitch View (Preserved for presentation)
  // -------------------------------------------------------------
  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">

      {/* Top Banner: Enriched Capacity Assistant */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-extrabold text-base shrink-0">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">¿Cuándo puedo coger este coche?</h2>
                <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                  Modo Demo Activo
                </span>
              </div>
              <p className="text-xs text-slate-500">
                BibendIA analiza la capacidad del taller y sugiere el mejor hueco disponible sin sobrecargar la agenda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'week' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Vista Semana
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'day' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Vista Día
            </button>
          </div>
        </div>

        {/* 3 Capacity Enriched Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="telemetry-strip-mint bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                ✓ Buen hueco
              </span>
              <span className="text-xs text-slate-500 font-mono">Carga: Baja</span>
            </div>
            <p className="text-sm font-bold text-slate-900">Jueves 17 — 10:30 h</p>
            <p className="text-xs text-slate-500">Recomendado para revisión de cliente (75 min)</p>
            <button
              onClick={() => confirmAppointmentSlot('2026-09-17', '10:30')}
              className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
            >
              Agendar para Jueves 10:30
            </button>
          </div>

          <div className="telemetry-strip-mint bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                ✓ Buen hueco
              </span>
              <span className="text-xs text-slate-500 font-mono">Carga: Óptima</span>
            </div>
            <p className="text-sm font-bold text-slate-900">Viernes 18 — 08:30 h</p>
            <p className="text-xs text-slate-500">Hueco primera hora para trabajos rápidos (45 min)</p>
            <button
              onClick={() => confirmAppointmentSlot('2026-09-18', '08:30')}
              className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all"
            >
              Agendar para Viernes 08:30
            </button>
          </div>

          <div className="telemetry-strip-amber bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2 sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                Disponible
              </span>
              <span className="text-xs text-slate-500 font-mono">Carga: Media</span>
            </div>
            <p className="text-sm font-bold text-slate-900">Viernes 18 — 16:00 h</p>
            <p className="text-xs text-slate-500">Hueco libre de tarde en elevador 2</p>
            <button className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all">
              Ver hueco tarde
            </button>
          </div>
        </div>
      </div>

      {/* Visual Weekly Workshop Grid */}
      {viewMode === 'week' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              <span>Calendario Semanal de Citas y Huecos Libres</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Semana del 15 al 19 de Septiembre 2026</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            {daysOfWeek.map(d => {
              const dayApps = demoAppointments.filter(a => a.date === d.date);
              const isSelected = selectedDay === d.date;

              return (
                <div
                  key={d.date}
                  onClick={() => setSelectedDay(d.date)}
                  className={`bg-white border rounded-2xl p-3.5 sm:p-4 space-y-2.5 cursor-pointer transition-all ${
                    isSelected ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">{d.full}</span>
                    <span className="text-xs text-slate-500 font-mono">{dayApps.length} citas</span>
                  </div>

                  <div className="space-y-2 min-h-[120px] sm:min-h-[140px]">
                    {dayApps.map(app => {
                      const veh = demoVehicles.find(v => v.id === app.vehicleId);
                      return (
                        <div key={app.id} className="p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-blue-600 text-xs font-mono">{app.time}</span>
                            {veh && <span className="license-plate">{veh.plate}</span>}
                          </div>
                          <p className="font-bold text-slate-900 truncate text-xs">{app.serviceName}</p>
                          <p className="text-[11px] text-slate-500">Mecánico: {app.assignedMechanic || 'Jon'}</p>
                        </div>
                      );
                    })}

                    {dayApps.length === 0 && (
                      <div className="h-full flex items-center justify-center p-4 text-xs text-slate-400 text-center border border-dashed border-slate-200 rounded-xl">
                        Hueco libre disponible
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily List Schedule */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
            Detalle de Citas — {daysOfWeek.find(d => d.date === selectedDay)?.full || 'Jueves 17'}
          </h3>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
            {daysOfWeek.map(d => (
              <button
                key={d.date}
                onClick={() => setSelectedDay(d.date)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedDay === d.date ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3.5">
          {demoAppointments
            .filter(a => a.date === selectedDay)
            .map(app => {
              const customer = demoCustomers.find(c => c.id === app.customerId);
              const vehicle = demoVehicles.find(v => v.id === app.vehicleId);

              return (
                <div
                  key={app.id}
                  className="telemetry-strip-cobalt bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-center shrink-0 font-mono">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">HORA</span>
                      <span className="text-base font-extrabold text-blue-600">{app.time}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{app.serviceName}</h4>
                        {vehicle && <span className="license-plate">{vehicle.plate}</span>}
                      </div>
                      <p className="text-xs text-slate-600">
                        Cliente: <strong className="text-slate-900 font-bold">{customer?.name}</strong> · {vehicle?.brand} {vehicle?.model}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {app.estimatedDurationMinutes} min estim.</span>
                        <span>Asignado a: <strong className="text-slate-700 font-semibold">{app.assignedMechanic || 'Jon'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                      app.status === 'completed' || app.status === 'sent_to_dms'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}>
                      <Check className="w-3.5 h-3.5" />
                      {app.status === 'completed' ? 'Trabajo Terminado' : app.status === 'sent_to_dms' ? 'Enviado a ERP' : 'Cita Confirmada'}
                    </span>
                  </div>
                </div>
              );
            })}

          {demoAppointments.filter(a => a.date === selectedDay).length === 0 && (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
              Sin citas agendadas para esta fecha. Carga de taller 100% disponible.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
