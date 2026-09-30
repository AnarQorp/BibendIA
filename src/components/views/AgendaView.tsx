import React, { useState, useEffect, useMemo } from 'react';
import { useDemo } from '../../context/DemoContext';
import { useRouter } from '../../router/RouterContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Check,
  User,
  Car,
  Wrench,
  AlertCircle,
  Sparkles,
  Lock,
  RotateCcw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Phone,
  Filter,
  CheckCircle2,
  X,
  FileText,
  Plus
} from 'lucide-react';
import {
  fetchWorkshopAppointments,
  getWorkshopTenantId,
  type WorkshopAppointmentsState
} from '../../services/workshopAppointments';
import { loadHumanSession } from '../../services/humanSession';
import type { WorkshopAppointmentResponse } from '../../types';
import { formatAppointmentSource } from '../../utils/workshopFormatters';
import { ManualAppointmentModal } from './ManualAppointmentModal';
import { ManualCustomerModal } from './ManualCustomerModal';
import { ManualVehicleModal } from './ManualVehicleModal';

export interface AgendaViewProps {
  tenantId?: string | null;
}

interface NormalizedAppointment {
  id: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  endStr: string;  // HH:mm
  customerName: string;
  vehiclePlate: string;
  serviceTitle: string;
  symptoms: string[];
  durationMinutes: number;
  status: string;
  source: 'phone_ai' | 'workshop' | 'web';
  evidenceRef?: string | null;
  version?: number;
  raw?: any;
}

export const AgendaView: React.FC<AgendaViewProps> = ({ tenantId: propTenantId = null }) => {
  const {
    appointments: demoAppointments,
    customers: demoCustomers,
    vehicles: demoVehicles,
    confirmAppointmentSlot,
    demoModeActive
  } = useDemo();

  const { searchParams, navigate } = useRouter();

  // Tenant Resolution (Prop -> Window/Env -> URL param -> LocalStorage)
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
    if (propTenantId) return propTenantId;
    const resolved = getWorkshopTenantId();
    if (resolved) return resolved;
    if (typeof window !== 'undefined') {
      const fromUrl = searchParams.get('tenant');
      if (fromUrl) return fromUrl;
      const stored = localStorage.getItem('bibendia_tenant_id');
      if (stored) return stored;
    }
    return null;
  });

  const [tenantInput, setTenantInput] = useState('');
  const [showTenantModal, setShowTenantModal] = useState(false);

  // Automatic Session Resolution: If authenticated, resolve tenant without manual selector
  useEffect(() => {
    let isMounted = true;
    async function resolveFromSession() {
      if (activeTenantId) return;
      try {
        const session = await loadHumanSession();
        if (!isMounted) return;
        if (session?.tenantIds && session.tenantIds.length > 0) {
          const tId = session.tenantIds[0];
          setActiveTenantId(tId);
        }
      } catch {
        // Fall back gracefully
      }
    }
    resolveFromSession();
    return () => { isMounted = false; };
  }, [activeTenantId]);

  // Calendar Navigation & Views
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'day'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 29)); // Default to Sep 29, 2026 or today
  const [selectedAppointment, setSelectedAppointment] = useState<NormalizedAppointment | null>(null);
  const [isManualAppointmentModalOpen, setIsManualAppointmentModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);

  // Real Backend Data State
  const [realState, setRealState] = useState<WorkshopAppointmentsState>({ status: 'idle' });

  const loadRealAppointments = async (tId: string) => {
    if (!tId) {
      setRealState({ status: 'idle' });
      return;
    }
    setRealState({ status: 'loading' });
    const res = await fetchWorkshopAppointments({ tenantId: tId });
    setRealState(res);
  };

  useEffect(() => {
    if (!demoModeActive && activeTenantId) {
      loadRealAppointments(activeTenantId);
    }
  }, [demoModeActive, activeTenantId]);

  const handleSaveTenantId = (e: React.FormEvent) => {
    e.preventDefault();
    if (tenantInput.trim()) {
      const cleanId = tenantInput.trim();
      setActiveTenantId(cleanId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bibendia_tenant_id', cleanId);
      }
      setShowTenantModal(false);
      loadRealAppointments(cleanId);
    }
  };

  // Convert real or demo appointments into a unified array
  const allAppointments: NormalizedAppointment[] = useMemo(() => {
    if (!demoModeActive && realState.status === 'success' && realState.data) {
      return realState.data.map(app => {
        const start = new Date(app.start_at);
        const end = new Date(app.end_at);
        const yyyy = start.getFullYear();
        const mm = String(start.getMonth() + 1).padStart(2, '0');
        const dd = String(start.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const timeStr = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const endStr = end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)) || 60;

        return {
          id: app.id,
          dateStr,
          timeStr,
          endStr,
          customerName: app.customer_name || 'Cliente Verificado',
          vehiclePlate: app.vehicle_plate || '—',
          serviceTitle: app.service_request?.intent || (app.service_request?.symptoms?.[0] ? `Revisión: ${app.service_request.symptoms[0]}` : 'Intervención de Taller'),
          symptoms: app.service_request?.symptoms || [],
          durationMinutes: app.service_request?.estimated_duration_minutes || duration,
          status: app.status || 'confirmed',
          source: app.origin === 'workshop_manual' ? 'workshop' : (app.origin === 'web_lead' ? 'web' : 'phone_ai'),
          evidenceRef: app.confirmation_evidence_ref,
          version: app.version,
          raw: app
        };
      });
    }

    // Demo Mode or Fallback Dataset
    return demoAppointments.map(app => {
      const cust = demoCustomers.find(c => c.id === app.customerId);
      const veh = demoVehicles.find(v => v.id === app.vehicleId);
      return {
        id: app.id,
        dateStr: app.date,
        timeStr: app.time,
        endStr: calculateEndTime(app.time, app.estimatedDurationMinutes),
        customerName: cust?.name || 'Cliente',
        vehiclePlate: veh?.plate || '—',
        serviceTitle: app.serviceName,
        symptoms: [],
        durationMinutes: app.estimatedDurationMinutes,
        status: app.status,
        source: app.aiCreated ? 'phone_ai' : 'workshop',
        version: 1,
        raw: app
      };
    });
  }, [demoModeActive, realState, demoAppointments, demoCustomers, demoVehicles]);

  // Calendar calculations
  // Get start of week (Monday)
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }, [currentDate]);

  // 6 Days of week: Lunes to Sábado
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dayFullNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      days.push({
        date: d,
        dateStr,
        dayName: dayNames[d.getDay()],
        fullDayName: dayFullNames[d.getDay()],
        dayNum: d.getDate()
      });
    }
    return days;
  }, [weekStart]);

  // Hours: 08:00 to 19:00
  const hours = useMemo(() => {
    const h = [];
    for (let i = 8; i <= 18; i++) {
      h.push(`${String(i).padStart(2, '0')}:00`);
    }
    return h;
  }, []);

  // Date Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 8, 29)); // Or new Date()
  };

  const formattedRange = useMemo(() => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const endDay = new Date(weekDays[5].date);
      return `${weekDays[0].date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${endDay.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [currentDate, viewMode, weekDays]);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      
      {/* Header & Operational Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-blue-600" /> Agenda de Taller
              </span>
              <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Conectado
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Calendario Operativo y Planificación
            </h1>
            <p className="text-xs text-slate-500">
              Vista horaria completa de citas, capacidad de elevadores y recepción telefónica automatizada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Semanal
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Diario
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Mensual
              </button>
            </div>

            {/* New Manual Appointment Button */}
            {activeTenantId && (
              <button
                onClick={() => setIsManualAppointmentModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                title="Crear cita manual de taller"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nueva Cita</span>
              </button>
            )}

            {/* New Customer Button */}
            {activeTenantId && (
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-300 shadow-2xs"
                title="Registrar nuevo cliente en taller"
              >
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>+ Nuevo cliente</span>
              </button>
            )}

            {/* New Vehicle Button */}
            {activeTenantId && (
              <button
                onClick={() => setIsVehicleModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-300 shadow-2xs"
                title="Añadir nuevo vehículo en taller"
              >
                <Car className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ Añadir vehículo</span>
              </button>
            )}

            {/* Sync Button */}
            {!demoModeActive && activeTenantId && (
              <button
                onClick={() => loadRealAppointments(activeTenantId)}
                disabled={realState.status === 'loading'}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                title="Sincronizar con el taller"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${realState.status === 'loading' ? 'animate-spin' : ''}`} />
                <span>Sincronizar</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 transition"
              title="Período anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
            >
              Hoy
            </button>
            <button
              onClick={handleNext}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 transition"
              title="Período siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-sm font-extrabold text-slate-900 capitalize ml-2">
              {formattedRange}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Confirmada ({allAppointments.length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Hueco Disponible
            </span>
          </div>
        </div>
      </div>

      {/* Backend Status State (When not in demo mode) */}
      {!demoModeActive && realState.status === 'loading' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs space-y-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-600">Consultando citas reales del taller...</p>
        </div>
      )}

      {!demoModeActive && realState.status === 'unauthorized' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Sesión requerida para consultar la agenda</p>
            <p className="text-amber-800">{realState.message} (Mostrando vista operativa mientras se completa el inicio de sesión).</p>
          </div>
        </div>
      )}

      {!demoModeActive && realState.status === 'error' && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error al consultar la agenda del taller</p>
            <p className="text-rose-800">{realState.message}</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. WEEK VIEW: Professional Workshop Hourly Grid                           */}
      {/* ========================================================================= */}
      {viewMode === 'week' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[850px]">
              
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10">
                <div className="p-3 text-center border-r border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Hora
                </div>
                {weekDays.map(day => {
                  const dayApps = allAppointments.filter(a => a.dateStr === day.dateStr);
                  const isCurrent = day.dateStr === '2026-09-29'; // Today's date marker

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => {
                        setCurrentDate(day.date);
                        setViewMode('day');
                      }}
                      className={`p-3 text-center border-r border-slate-200 cursor-pointer transition hover:bg-blue-50/50 ${
                        isCurrent ? 'bg-blue-50/70 border-b-2 border-b-blue-600' : ''
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-500 uppercase block">{day.dayName}</span>
                      <span className="text-base font-extrabold text-slate-900 block font-mono">{day.dayNum}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                        dayApps.length > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {dayApps.length} {dayApps.length === 1 ? 'cita' : 'citas'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Hourly Grid Rows */}
              <div className="divide-y divide-slate-100">
                {hours.map(hour => {
                  const hourInt = parseInt(hour.split(':')[0], 10);

                  return (
                    <div key={hour} className="grid grid-cols-7 min-h-[75px]">
                      {/* Hour Column */}
                      <div className="p-2 border-r border-slate-200 text-center text-xs font-mono font-bold text-slate-400 bg-slate-50/40 flex items-start justify-center pt-2">
                        {hour}
                      </div>

                      {/* 6 Day Columns for this hour */}
                      {weekDays.map(day => {
                        const cellApps = allAppointments.filter(a => {
                          if (a.dateStr !== day.dateStr) return false;
                          const aHour = parseInt(a.timeStr.split(':')[0], 10);
                          return aHour === hourInt;
                        });

                        return (
                          <div
                            key={day.dateStr}
                            className="p-1.5 border-r border-slate-100 hover:bg-slate-50/60 transition relative flex flex-col gap-1.5"
                          >
                            {cellApps.map(app => (
                              <button
                                key={app.id}
                                onClick={() => setSelectedAppointment(app)}
                                className="w-full text-left p-2 rounded-xl border bg-blue-50/90 border-blue-300 shadow-2xs hover:bg-blue-100 transition-all flex flex-col gap-1 group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-blue-700 text-[11px] font-mono">
                                    {app.timeStr}
                                  </span>
                                  <span className="license-plate text-[10px] px-1.5 py-0.2">
                                    {app.vehiclePlate}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                                  {app.serviceTitle}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-slate-600">
                                  <span className="truncate">{app.customerName}</span>
                                  {(() => {
                                    const src = formatAppointmentSource(app.source);
                                    return (
                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${src.bg} ${src.text} ${src.border}`}>
                                        {src.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </button>
                            ))}

                            {cellApps.length === 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentDate(new Date(day.date));
                                  setViewMode('day');
                                }}
                                title={`Ver planificación del ${day.fullDayName} ${day.dayNum} a las ${hour}`}
                                className="h-full w-full rounded-lg border border-dashed border-transparent hover:border-slate-300 flex items-center justify-center text-[10px] text-slate-300 hover:text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                              >
                                + Libre
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DAY VIEW: Hour-by-Hour Timeline with Slots Detail                      */}
      {/* ========================================================================= */}
      {viewMode === 'day' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Planificación Diaria — {currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500">Distribución horaria de intervenciones programadas en el taller.</p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl">
              {allAppointments.filter(a => a.dateStr === weekDays.find(w => w.date.toDateString() === currentDate.toDateString())?.dateStr).length} Citas hoy
            </span>
          </div>

          <div className="space-y-3">
            {hours.map(hour => {
              const hourInt = parseInt(hour.split(':')[0], 10);
              const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
              const slotApps = allAppointments.filter(a => a.dateStr === currentDateStr && parseInt(a.timeStr.split(':')[0], 10) === hourInt);

              return (
                <div key={hour} className="flex gap-4 items-start p-2 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200">
                  <div className="w-16 pt-2 text-xs font-mono font-extrabold text-slate-500 shrink-0 text-right">
                    {hour}
                  </div>

                  <div className="flex-1 space-y-2">
                    {slotApps.length > 0 ? (
                      slotApps.map(app => (
                        <div
                          key={app.id}
                          onClick={() => setSelectedAppointment(app)}
                          className="telemetry-strip-cobalt bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-blue-400 transition"
                        >
                          <div className="flex items-start gap-4">
                            <div className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl text-center shrink-0 font-mono">
                              <span className="text-[10px] font-bold text-blue-600 block uppercase">INICIO</span>
                              <span className="text-sm font-extrabold text-blue-800">{app.timeStr}</span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-900">{app.serviceTitle}</h4>
                                <span className="license-plate">{app.vehiclePlate}</span>
                                {(() => {
                                  const src = formatAppointmentSource(app.source);
                                  return (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${src.bg} ${src.text} ${src.border}`}>
                                      {src.label}
                                    </span>
                                  );
                                })()}
                              </div>
                              <p className="text-xs text-slate-600">
                                Cliente: <strong className="text-slate-900 font-bold">{app.customerName}</strong>
                              </p>
                              {app.symptoms.length > 0 && (
                                <p className="text-[11px] text-slate-500">
                                  Síntomas: {app.symptoms.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {app.durationMinutes} min
                            </span>
                            <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-blue-50 text-blue-800 border-blue-200 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> {app.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 flex items-center justify-between">
                        <span>Hueco libre en elevadores (Capacidad disponible)</span>
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">Disponible</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MONTH VIEW: Month Matrix Grid with Appointment Badges                  */}
      {/* ========================================================================= */}
      {viewMode === 'month' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="grid grid-cols-7 text-center font-bold text-xs uppercase text-slate-400 border-b border-slate-100 pb-2">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, idx) => {
              const dayNum = (idx % 30) + 1;
              const dateStr = `2026-09-${String(dayNum).padStart(2, '0')}`;
              const dayApps = allAppointments.filter(a => a.dateStr === dateStr);
              const isSelected = currentDate.getDate() === dayNum;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    const d = new Date(currentDate);
                    d.setDate(dayNum);
                    setCurrentDate(d);
                    setViewMode('day');
                  }}
                  className={`min-h-[90px] p-2 border rounded-xl cursor-pointer transition flex flex-col justify-between ${
                    isSelected ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-800 font-mono">{dayNum}</span>
                    {dayApps.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayApps.slice(0, 2).map(app => (
                      <div key={app.id} className="text-[10px] p-1 bg-slate-100 text-slate-800 rounded font-semibold truncate">
                        {app.timeStr} {app.vehiclePlate}
                      </div>
                    ))}
                    {dayApps.length > 2 && (
                      <span className="text-[10px] text-blue-600 font-bold block">
                        +{dayApps.length - 2} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. APPOINTMENT DETAIL MODAL (Apertura de Detalle Operativo)                */}
      {/* ========================================================================= */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                    Cita en Taller
                  </span>
                  {(() => {
                    const src = formatAppointmentSource(selectedAppointment.source);
                    return (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${src.bg} ${src.text} ${src.border}`}>
                        {src.label}
                      </span>
                    );
                  })()}
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {selectedAppointment.status}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{selectedAppointment.serviceTitle}</h3>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Fecha y Hora</span>
                  <p className="font-extrabold text-slate-900 text-sm font-mono mt-0.5">
                    {selectedAppointment.dateStr} · {selectedAppointment.timeStr} h
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Duración Estimada</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {selectedAppointment.durationMinutes} minutos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Cliente Autorizado</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {selectedAppointment.customerName}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Matrícula</span>
                  <span className="license-plate inline-block mt-1">
                    {selectedAppointment.vehiclePlate}
                  </span>
                </div>
              </div>

              {selectedAppointment.symptoms.length > 0 && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Síntomas Reportados</span>
                  <p className="text-slate-800 font-semibold">{selectedAppointment.symptoms.join(', ')}</p>
                </div>
              )}

              {selectedAppointment.evidenceRef && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cita confirmada y validada en el sistema del taller.</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetVehicleId = selectedAppointment.raw?.vehicle_id || '';
                    const params = new URLSearchParams();
                    params.set('new', 'rk');
                    if (targetVehicleId) params.set('vehicleId', targetVehicleId);
                    if (selectedAppointment.vehiclePlate && selectedAppointment.vehiclePlate !== '—') {
                      params.set('plate', selectedAppointment.vehiclePlate);
                    }
                    if (selectedAppointment.serviceTitle) params.set('reason', selectedAppointment.serviceTitle);
                    setSelectedAppointment(null);
                    navigate(`/presupuestos?${params.toString()}`);
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Presupuesto con RK</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetVehicleId = selectedAppointment.raw?.vehicle_id || '';
                    const targetCustomerId = selectedAppointment.raw?.customer_id || '';
                    const params = new URLSearchParams();
                    params.set('new', 'manual');
                    params.set('appointmentId', selectedAppointment.id);
                    if (targetVehicleId) params.set('vehicleId', targetVehicleId);
                    if (targetCustomerId) params.set('customerId', targetCustomerId);
                    if (selectedAppointment.customerName && selectedAppointment.customerName !== 'Cliente Verificado' && selectedAppointment.customerName !== 'Cliente') {
                      params.set('customerName', selectedAppointment.customerName);
                    }
                    if (selectedAppointment.vehiclePlate && selectedAppointment.vehiclePlate !== '—') {
                      params.set('plate', selectedAppointment.vehiclePlate);
                    }
                    if (selectedAppointment.serviceTitle) params.set('reason', selectedAppointment.serviceTitle);
                    setSelectedAppointment(null);
                    navigate(`/presupuestos?${params.toString()}`);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Presupuesto Manual</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition text-center"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TENANT CONFIGURATION MODAL                                             */}
      {/* ========================================================================= */}
      {showTenantModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Configurar Tenant de Taller</h3>
              <button onClick={() => setShowTenantModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTenantId} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Identificador UUID del Taller (Tenant ID):</label>
                <input
                  type="text"
                  value={tenantInput}
                  onChange={e => setTenantInput(e.target.value)}
                  placeholder="Ej. c306c70e-c02c-47c6-8742-536ba9c02e8e"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500">
                  Permite conectar la vista con tu taller real. Puedes consultar tus tenants en Platform Admin.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTenantModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Guardar y Conectar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Appointment Modal */}
      {activeTenantId && (
        <ManualAppointmentModal
          isOpen={isManualAppointmentModalOpen}
          onClose={() => setIsManualAppointmentModalOpen(false)}
          tenantId={activeTenantId}
          onAppointmentCreated={() => {
            loadRealAppointments(activeTenantId);
          }}
        />
      )}

      {/* Manual Customer Modal */}
      {activeTenantId && (
        <ManualCustomerModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          tenantId={activeTenantId}
          onCustomerCreated={() => {
            loadRealAppointments(activeTenantId);
          }}
        />
      )}

      {/* Manual Vehicle Modal */}
      {activeTenantId && (
        <ManualVehicleModal
          isOpen={isVehicleModalOpen}
          onClose={() => setIsVehicleModalOpen(false)}
          tenantId={activeTenantId}
          onVehicleCreated={() => {
            loadRealAppointments(activeTenantId);
          }}
        />
      )}

    </div>
  );
};

function calculateEndTime(timeStr: string, durationMinutes: number): string {
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  } catch {
    return timeStr;
  }
}
