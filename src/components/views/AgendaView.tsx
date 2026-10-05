import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Plus,
  ArrowRight,
  CalendarCheck2,
  Timer,
  Info,
  Layers,
  Activity
} from 'lucide-react';
import {
  fetchWorkshopAppointments,
  getWorkshopTenantId,
  type WorkshopAppointmentsState
} from '../../services/workshopAppointments';
import {
  listWorkshopCustomers,
  listWorkshopVehicles,
  listTenantWorkshops,
  getWorkshopCapacity,
  updateAppointmentStatus
} from '../../services/workshopOperations';
import { loadHumanSession } from '../../services/humanSession';
import type { WorkshopCustomer, WorkshopVehicle, WorkshopAppointmentResponse } from '../../types';
import {
  formatAppointmentSource,
  formatAppointmentStatus,
  formatCustomerWaitMode,
  type CanonicalAppointmentOrigin,
  type CanonicalAppointmentStatus,
  type CustomerWaitMode
} from '../../utils/workshopFormatters';
import { SpanishPlateBadge } from './DirectorioView';
import { ManualAppointmentModal } from './ManualAppointmentModal';
import { WorkshopCapacityConfigSection } from '../admin/views/WorkshopCapacityConfigSection';

export interface AgendaViewProps {
  tenantId?: string | null;
}

export interface NormalizedAppointment {
  id: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  endStr: string;  // HH:mm
  customerName: string;
  customerPhone?: string | null;
  customerId?: string | null;
  vehiclePlate: string;
  vehicleInfo?: string | null;
  vehicleId?: string | null;
  serviceTitle: string;
  symptoms: string[];
  durationMinutes: number;
  status: CanonicalAppointmentStatus | string;
  customerWaitMode?: 'DROP_OFF' | 'WAIT_ON_SITE';
  source: CanonicalAppointmentOrigin;
  evidenceRef?: string | null;
  version?: number;
  raw?: any;
}

export interface DayOperationalMetrics {
  totalCount: number;
  firstAppointmentTime: string | null;
  totalHours: number;
  remainingMinutes: number;
  confirmedCount: number;
  tentativeCount: number;
}

/**
 * Computes strictly observable operational day metrics from appointments.
 * Zero synthetic capacity, zero fictional limits.
 */
export function computeDayOperationalMetrics(
  appointments: Array<{ timeStr: string; durationMinutes?: number; status: string }>
): DayOperationalMetrics {
  const totalCount = appointments.length;
  const firstAppointmentTime = appointments.length > 0 ? appointments[0].timeStr : null;
  const totalDurationMinutes = appointments.reduce((acc, a) => acc + (a.durationMinutes || 0), 0);
  const totalHours = Math.floor(totalDurationMinutes / 60);
  const remainingMinutes = totalDurationMinutes % 60;

  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length;
  const tentativeCount = appointments.filter(a => a.status === 'tentative' || a.status === 'held').length;

  return {
    totalCount,
    firstAppointmentTime,
    totalHours,
    remainingMinutes,
    confirmedCount,
    tentativeCount
  };
}

/**
 * Normalizes a canonical backend WorkshopAppointmentResponse into the presentation model.
 * Guarantees zero technical leak (no UUIDs in text fields).
 */
export function formatAppointmentForPresentation(
  app: WorkshopAppointmentResponse,
  cachedCustomer?: WorkshopCustomer,
  cachedVehicle?: WorkshopVehicle
): NormalizedAppointment {
  const start = new Date(app.start_at);
  const end = new Date(app.end_at);
  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const dd = String(start.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const timeStr = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)) || 60;

  const vehicleInfo = cachedVehicle
    ? [cachedVehicle.make, cachedVehicle.model].filter(Boolean).join(' ')
    : null;

  let source: CanonicalAppointmentOrigin = 'workshop_manual';
  if (app.origin === 'voice_phone' || app.origin === 'web_lead' || app.origin === 'dms_import' || app.origin === 'workshop_manual') {
    source = app.origin;
  }

  const status: CanonicalAppointmentStatus | string = app.status || 'confirmed';
  const customerWaitMode: 'DROP_OFF' | 'WAIT_ON_SITE' = app.customer_wait_mode || (app as any).customerWaitMode || 'DROP_OFF';

  return {
    id: app.id,
    dateStr,
    timeStr,
    endStr,
    customerName: app.customer_name || cachedCustomer?.name || 'Cliente Verificado',
    customerPhone: cachedCustomer?.phone || null,
    customerId: app.customer_id || null,
    vehiclePlate: app.vehicle_plate || cachedVehicle?.plate || '—',
    vehicleInfo: vehicleInfo || null,
    vehicleId: app.vehicle_id || null,
    serviceTitle: app.service_request?.intent || (app.service_request?.symptoms?.[0] ? `Revisión: ${app.service_request.symptoms[0]}` : 'Intervención de Taller'),
    symptoms: app.service_request?.symptoms || [],
    durationMinutes: app.service_request?.estimated_duration_minutes || duration,
    status,
    customerWaitMode,
    source,
    evidenceRef: app.confirmation_evidence_ref,
    version: app.version,
    raw: app
  };
}

export const ALLOWED_OPERATIONAL_TRANSITIONS: Record<string, { nextStatus: 'awaiting_arrival' | 'on_site' | 'in_progress' | 'waiting' | 'completed' | 'delivered' | 'cancelled'; label: string; primary?: boolean }[]> = {
  confirmed: [
    { nextStatus: 'on_site', label: 'Marcar llegada', primary: true }
  ],
  awaiting_arrival: [
    { nextStatus: 'on_site', label: 'Marcar llegada', primary: true }
  ],
  on_site: [
    { nextStatus: 'in_progress', label: 'Iniciar trabajo', primary: true }
  ],
  in_progress: [
    { nextStatus: 'waiting', label: 'Poner en espera' },
    { nextStatus: 'completed', label: 'Completar trabajo', primary: true }
  ],
  waiting: [
    { nextStatus: 'in_progress', label: 'Continuar trabajo', primary: true },
    { nextStatus: 'completed', label: 'Completar trabajo' }
  ],
  completed: [
    { nextStatus: 'delivered', label: 'Entregar vehículo', primary: true }
  ],
  delivered: [],
  cancelled: [],
  tentative: [],
  held: []
};

export const AgendaView: React.FC<AgendaViewProps> = ({ tenantId: propTenantId = null }) => {
  const {
    appointments: demoAppointments,
    customers: demoCustomers,
    vehicles: demoVehicles,
    confirmAppointmentSlot,
    demoModeActive
  } = useDemo();

  const { searchParams, navigate } = useRouter();
  const urlNew = searchParams.get('new');
  const urlCustomerId = searchParams.get('customerId') || undefined;
  const urlVehicleId = searchParams.get('vehicleId') || undefined;

  // Tabs: 'citas' vs 'capacidad'
  const [activeTab, setActiveTab] = useState<'citas' | 'capacidad'>(() => {
    return searchParams.get('tab') === 'capacidad' ? 'capacidad' : 'citas';
  });

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
  const [resolvedWorkshopId, setResolvedWorkshopId] = useState<string | null>(null);

  // Authoritative capacity metrics from backend
  const [vehiclesCurrentlyOnSite, setVehiclesCurrentlyOnSite] = useState<number | null>(null);
  const [maxVehiclesOnSite, setMaxVehiclesOnSite] = useState<number>(8);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

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

  // B1. Default View: Agenda Día is the absolute priority
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  // Baseline demo date is 2026-09-29; in real mode default to today
  const getTodayReference = () => (demoModeActive ? new Date(2026, 8, 29) : new Date());
  const [currentDate, setCurrentDate] = useState<Date>(() => getTodayReference());

  const [selectedAppointment, setSelectedAppointment] = useState<NormalizedAppointment | null>(null);
  const [isManualAppointmentModalOpen, setIsManualAppointmentModalOpen] = useState(false);

  // Background directory cache for customer phones & vehicle models in real mode
  const [cachedCustomers, setCachedCustomers] = useState<Record<string, WorkshopCustomer>>({});
  const [cachedVehicles, setCachedVehicles] = useState<Record<string, WorkshopVehicle>>({});

  useEffect(() => {
    if (urlNew === 'manual') {
      setIsManualAppointmentModalOpen(true);
    }
  }, [urlNew]);

  // Real Backend Data State
  const [realState, setRealState] = useState<WorkshopAppointmentsState>({ status: 'idle' });

  const loadCapacityData = useCallback(async (tId: string, wsId: string) => {
    if (!tId || !wsId) return;
    try {
      const res = await getWorkshopCapacity(tId, wsId);
      if (res.status === 'success' && res.data) {
        if (typeof res.data.vehiclesCurrentlyOnSite === 'number') {
          setVehiclesCurrentlyOnSite(res.data.vehiclesCurrentlyOnSite);
        }
        if (res.data.capacity_policy?.maxVehiclesOnSite) {
          setMaxVehiclesOnSite(res.data.capacity_policy.maxVehiclesOnSite);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const loadRealAppointments = useCallback(async (tId: string) => {
    if (!tId) {
      setRealState({ status: 'idle' });
      return;
    }
    setRealState({ status: 'loading' });
    const res = await fetchWorkshopAppointments({ tenantId: tId });
    setRealState(res);

    if (res.status === 'success' && res.data && res.data.length > 0 && !resolvedWorkshopId) {
      const firstWs = res.data[0].workshop_id;
      if (firstWs) {
        setResolvedWorkshopId(firstWs);
        loadCapacityData(tId, firstWs);
      }
    }

    // Concurrently enrich customer & vehicle directory data for phone numbers & models
    listWorkshopCustomers(tId, { limit: 100 }).then(r => {
      if (r.status === 'success' && r.data) {
        const map: Record<string, WorkshopCustomer> = {};
        r.data.forEach(c => { map[c.id] = c; });
        setCachedCustomers(map);
      }
    }).catch(() => {});

    listWorkshopVehicles(tId, { limit: 100 }).then(r => {
      if (r.status === 'success' && r.data) {
        const map: Record<string, WorkshopVehicle> = {};
        r.data.forEach(v => { map[v.id] = v; });
        setCachedVehicles(map);
      }
    }).catch(() => {});
  }, [loadCapacityData, resolvedWorkshopId]);

  useEffect(() => {
    if (!demoModeActive && activeTenantId) {
      loadRealAppointments(activeTenantId);
      listTenantWorkshops(activeTenantId).then(r => {
        if (r.status === 'success' && r.data && r.data.length > 0) {
          const wsId = r.data[0].id;
          setResolvedWorkshopId(wsId);
          loadCapacityData(activeTenantId, wsId);
        }
      }).catch(() => {});
    }
  }, [demoModeActive, activeTenantId, loadRealAppointments, loadCapacityData]);

  const handleUpdateAppointmentStatus = async (
    appt: NormalizedAppointment,
    nextStatus: 'awaiting_arrival' | 'on_site' | 'in_progress' | 'waiting' | 'completed' | 'delivered' | 'cancelled'
  ) => {
    if (!activeTenantId) return;
    setStatusUpdating(appt.id);
    const expectedVersion = appt.version ?? 1;
    const idempotencyKey = `status-${appt.id}-${nextStatus}-${Date.now()}`;
    const res = await updateAppointmentStatus(activeTenantId, appt.id, {
      status: nextStatus,
      expectedVersion,
      idempotencyKey,
    });
    setStatusUpdating(null);

    if (res.status === 'success') {
      await loadRealAppointments(activeTenantId);
      const wsId = resolvedWorkshopId || appt.raw?.workshop_id;
      if (wsId) {
        await loadCapacityData(activeTenantId, wsId);
      }
      setSelectedAppointment(null);
    } else {
      alert(res.message || 'Error al actualizar el estado de la cita.');
    }
  };

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
        const customer = app.customer_id ? cachedCustomers[app.customer_id] : undefined;
        const vehicle = app.vehicle_id ? cachedVehicles[app.vehicle_id] : undefined;
        return formatAppointmentForPresentation(app, customer, vehicle);
      });
    }

    // Demo Mode or Fallback Dataset
    return demoAppointments.map(app => {
      const cust = demoCustomers.find(c => c.id === app.customerId);
      const veh = demoVehicles.find(v => v.id === app.vehicleId);
      const vehInfo = veh ? [veh.brand, veh.model].filter(Boolean).join(' ') : null;

      return {
        id: app.id,
        dateStr: app.date,
        timeStr: app.time,
        endStr: calculateEndTime(app.time, app.estimatedDurationMinutes),
        customerName: cust?.name || 'Cliente',
        customerPhone: cust?.phone || null,
        customerId: app.customerId,
        vehiclePlate: veh?.plate || '—',
        vehicleInfo: vehInfo,
        vehicleId: app.vehicleId,
        serviceTitle: app.serviceName,
        symptoms: [],
        durationMinutes: app.estimatedDurationMinutes,
        status: app.status,
        customerWaitMode: 'DROP_OFF',
        source: (app.aiCreated ? 'voice_phone' : 'workshop_manual') as CanonicalAppointmentOrigin,
        version: 1,
        raw: app
      };
    });
  }, [demoModeActive, realState, demoAppointments, demoCustomers, demoVehicles, cachedCustomers, cachedVehicles]);

  // Support direct deep-link navigation from Reception Cases
  const urlAppointmentId = searchParams.get('appointment');
  useEffect(() => {
    if (urlAppointmentId && allAppointments.length > 0) {
      const found = allAppointments.find(a => a.id === urlAppointmentId);
      if (found) {
        setSelectedAppointment(found);
      }
    }
  }, [urlAppointmentId, allAppointments]);

  // Current Date String in YYYY-MM-DD
  const currentDateStr = useMemo(() => {
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [currentDate]);

  // Is viewing today?
  const isViewingToday = useMemo(() => {
    const ref = getTodayReference();
    return (
      currentDate.getFullYear() === ref.getFullYear() &&
      currentDate.getMonth() === ref.getMonth() &&
      currentDate.getDate() === ref.getDate()
    );
  }, [currentDate, demoModeActive]);

  // Appointments for the selected day, sorted chronologically
  const dayAppointments = useMemo(() => {
    return allAppointments
      .filter(a => a.dateStr === currentDateStr)
      .sort((a, b) => a.timeStr.localeCompare(b.timeStr));
  }, [allAppointments, currentDateStr]);

  // Operational metrics for the day (strictly observable, zero synthetic rules)
  const dayMetrics = useMemo(() => {
    return computeDayOperationalMetrics(dayAppointments);
  }, [dayAppointments]);

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

  // Hours: 08:00 to 18:00
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
    if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(getTodayReference());
  };

  // Header Title Formatting
  const headerDateTitle = useMemo(() => {
    if (viewMode === 'week') {
      const startDay = weekDays[0].date;
      const endDay = weekDays[5].date;
      return `Semana del ${startDay.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} al ${endDay.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    const dayName = currentDate.toLocaleDateString('es-ES', { weekday: 'long' });
    const fullDate = currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    if (isViewingToday) {
      return `Hoy — ${capitalizedDay}, ${fullDate}`;
    }
    return `${capitalizedDay}, ${fullDate}`;
  }, [currentDate, viewMode, weekDays, isViewingToday]);

  const effectiveWorkshopId = resolvedWorkshopId || allAppointments[0]?.raw?.workshop_id || '';

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn w-full max-w-full overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* B2. CLEAN AGENDA HEADER                                                   */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-blue-600" /> Agenda de Taller
              </span>
              <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Conectado
              </span>
              {/* Read-only Vehicles on Site Metric */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-bold text-slate-700">
                <Car className="w-3.5 h-3.5 text-blue-600" />
                <span>Vehículos en taller: <strong className="text-slate-900 font-mono">{vehiclesCurrentlyOnSite ?? 0}</strong> / <span className="text-slate-500 font-mono">{maxVehiclesOnSite}</span></span>
              </div>
            </div>
            <h1 data-testid="agenda-date-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight capitalize">
              {activeTab === 'capacidad' ? 'Configuración de Capacidad y Agenda' : headerDateTitle}
            </h1>
            <p className="text-xs text-slate-500">
              {activeTab === 'capacidad'
                ? 'Gestión de aforo, puestos de trabajo, elevadores y horarios de apertura del taller.'
                : 'Control cronológico de entradas de taller, recepción telefónica IA y citas programadas.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Surface Tabs: Citas vs Capacidad y Agenda */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                data-testid="tab-citas"
                onClick={() => setActiveTab('citas')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer min-h-[44px] sm:min-h-0 flex items-center gap-1.5 ${
                  activeTab === 'citas'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Citas</span>
              </button>
              <button
                type="button"
                data-testid="tab-capacidad"
                onClick={() => setActiveTab('capacidad')}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer min-h-[44px] sm:min-h-0 flex items-center gap-1.5 ${
                  activeTab === 'capacidad'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Capacidad y Agenda</span>
              </button>
            </div>

            {activeTab === 'citas' && (
              <>
                {/* View Mode Toggle: Día | Semana */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    data-testid="toggle-day-view"
                    onClick={() => setViewMode('day')}
                    className={`px-4 py-2 rounded-lg transition cursor-pointer min-h-[44px] sm:min-h-0 ${
                      viewMode === 'day'
                        ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Día
                  </button>
                  <button
                    type="button"
                    data-testid="toggle-week-view"
                    onClick={() => setViewMode('week')}
                    className={`px-4 py-2 rounded-lg transition cursor-pointer min-h-[44px] sm:min-h-0 ${
                      viewMode === 'week'
                        ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semana
                  </button>
                </div>

                {/* Primary Action Button: + Nueva Cita */}
                {(activeTenantId || demoModeActive) && (
                  <button
                    type="button"
                    data-testid="button-nueva-cita"
                    onClick={() => setIsManualAppointmentModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer min-h-[44px]"
                    title="Crear cita manual de taller"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Nueva Cita</span>
                  </button>
                )}

                {/* Sync Button (real mode only) */}
                {!demoModeActive && activeTenantId && (
                  <button
                    type="button"
                    onClick={() => {
                      loadRealAppointments(activeTenantId);
                      if (effectiveWorkshopId) loadCapacityData(activeTenantId, effectiveWorkshopId);
                    }}
                    disabled={realState.status === 'loading'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-300 disabled:opacity-50 min-h-[44px] cursor-pointer"
                    title="Actualizar agenda con el taller"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${realState.status === 'loading' ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Sincronizar</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Date Navigation Controls (visible only in Citas tab) */}
        {activeTab === 'citas' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Día o período anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition min-h-[44px] cursor-pointer ${
                  isViewingToday
                    ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Día o período siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="text-sm font-extrabold text-slate-900 capitalize ml-2">
                {viewMode === 'day' ? currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Vista Semanal'}
              </span>
            </div>

            {/* Canonical Status Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Confirmada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> En taller
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> En trabajo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> En espera
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Libre
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB: CAPACIDAD Y AGENDA (SUPERFICIE WORKSHOP PARA OWNER/MANAGER)           */}
      {/* ========================================================================= */}
      {activeTab === 'capacidad' && (
        <div className="space-y-4">
          <WorkshopCapacityConfigSection
            tenantId={activeTenantId || '11111111-1111-4111-8111-111111111111'}
            workshopId={effectiveWorkshopId}
            surface="workshop"
            onWorkshopUpdated={() => {
              if (activeTenantId) {
                loadRealAppointments(activeTenantId);
                if (effectiveWorkshopId) {
                  loadCapacityData(activeTenantId, effectiveWorkshopId);
                }
              }
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CITAS (DÍA / SEMANA)                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'citas' && (
        <>
          {/* Operational Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <CalendarCheck2 className="w-4 h-4 text-blue-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Citas del día</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {dayMetrics.totalCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {dayMetrics.totalCount === 0 ? 'Sin citas programadas' : `${dayMetrics.totalCount} vehículo(s) en agenda`}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Primera entrada</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {dayMetrics.firstAppointmentTime ? `${dayMetrics.firstAppointmentTime} h` : '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {dayMetrics.firstAppointmentTime ? 'Hora de primera recepción' : 'Sin aperturas hoy'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Timer className="w-4 h-4 text-indigo-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Carga estimada</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {dayMetrics.totalHours}h {dayMetrics.remainingMinutes > 0 ? `${dayMetrics.remainingMinutes}m` : ''}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tiempo de mano de obra
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Aforo Taller</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono">
                  {vehiclesCurrentlyOnSite ?? 0} en taller
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  máx {maxVehiclesOnSite}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Aforo en tiempo real
              </p>
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

          {/* DAY VIEW */}
          {viewMode === 'day' && (
            <div className="space-y-3">
              {dayAppointments.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs space-y-4">
                  <div className="w-14 h-14 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                    <CalendarIcon className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h3 className="text-base font-extrabold text-slate-900">
                      No hay citas programadas para este día
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      El taller no tiene entradas registradas para esta jornada. Puedes programar una nueva cita con el botón superior.
                    </p>
                  </div>
                  {(activeTenantId || demoModeActive) && (
                    <button
                      type="button"
                      onClick={() => setIsManualAppointmentModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer min-h-[44px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agendar Cita en este Día</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dayAppointments.map(app => {
                    const sourceMeta = formatAppointmentSource(app.source);
                    const statusMeta = formatAppointmentStatus(app.status);
                    const waitModeMeta = formatCustomerWaitMode(app.customerWaitMode);

                    return (
                      <div
                        key={app.id}
                        onClick={() => setSelectedAppointment(app)}
                        className="telemetry-strip-cobalt bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        {/* Visual Hierarchy: 1. Hora -> 2. Matrícula -> 3. Vehículo -> 4. Cliente -> 5. Motivo */}
                        <div className="flex items-start gap-3.5 sm:gap-4 flex-1">
                          
                          {/* 1. Hora */}
                          <div className="bg-blue-50 border border-blue-200 px-3 py-2.5 rounded-xl text-center shrink-0 font-mono min-w-[76px] flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-blue-600 block uppercase tracking-wider">Entrada</span>
                            <span className="text-base font-black text-blue-900 leading-tight">{app.timeStr}</span>
                            <span className="text-[10px] text-blue-700 font-medium">{app.endStr}</span>
                          </div>

                          {/* Content block */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            {/* 2. Matrícula + 3. Vehículo + Tags */}
                            <div className="flex flex-wrap items-center gap-2">
                              <SpanishPlateBadge plate={app.vehiclePlate} />
                              {app.vehicleInfo && (
                                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                                  <Car className="w-3.5 h-3.5 text-slate-400" />
                                  {app.vehicleInfo}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${sourceMeta.bg} ${sourceMeta.text} ${sourceMeta.border}`}>
                                {sourceMeta.label}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${waitModeMeta.bg} ${waitModeMeta.text} ${waitModeMeta.border}`}>
                                {waitModeMeta.label}
                              </span>
                            </div>

                            {/* 4. Cliente */}
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-medium">Cliente:</span>
                              <span className="font-extrabold text-slate-900 truncate">
                                {app.customerName}
                              </span>
                              {app.customerPhone && (
                                <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">
                                  · {app.customerPhone}
                                </span>
                              )}
                            </div>

                            {/* 5. Motivo / Trabajo */}
                            <div className="text-xs text-slate-700 font-semibold truncate">
                              {app.serviceTitle}
                            </div>

                            {/* Symptoms tags if any */}
                            {app.symptoms.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {app.symptoms.map((symptom, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md"
                                  >
                                    {symptom}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 6. Estado canónico y métricas en extremo derecho */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                          <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> {app.durationMinutes} min
                          </span>
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`}></span>
                            {statusMeta.label}
                          </span>
                          <span className="text-slate-400 group-hover:text-blue-600 transition pl-1 hidden sm:inline">
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  
                  {/* Weekday Column Headers */}
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                    <div className="p-3 text-center border-r border-slate-200 text-xs font-bold text-slate-400 flex items-center justify-center font-mono">
                      Hora
                    </div>
                    {weekDays.map(day => {
                      const dayApps = allAppointments.filter(a => a.dateStr === day.dateStr);
                      const isDayToday = (
                        day.date.getFullYear() === getTodayReference().getFullYear() &&
                        day.date.getMonth() === getTodayReference().getMonth() &&
                        day.date.getDate() === getTodayReference().getDate()
                      );

                      return (
                        <div
                          key={day.dateStr}
                          onClick={() => {
                            setCurrentDate(day.date);
                            setViewMode('day');
                          }}
                          className={`p-3 text-center border-r border-slate-200 cursor-pointer transition hover:bg-blue-50/50 ${
                            isDayToday ? 'bg-blue-50/80 border-b-2 border-b-blue-600' : ''
                          }`}
                          title={`Ver citas del ${day.fullDayName}`}
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
                                {cellApps.map(app => {
                                  const statusMeta = formatAppointmentStatus(app.status);
                                  const waitModeMeta = formatCustomerWaitMode(app.customerWaitMode);
                                  return (
                                    <button
                                      key={app.id}
                                      type="button"
                                      onClick={() => setSelectedAppointment(app)}
                                      className="w-full text-left p-2 rounded-xl border bg-blue-50/90 border-blue-300 shadow-2xs hover:bg-blue-100 transition-all flex flex-col gap-1 group cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-extrabold text-blue-800 text-[11px] font-mono">
                                          {app.timeStr}
                                        </span>
                                        <SpanishPlateBadge plate={app.vehiclePlate} className="scale-90 origin-right" />
                                      </div>
                                      <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                                        {app.serviceTitle}
                                      </p>
                                      <div className="flex items-center justify-between text-[10px] text-slate-600">
                                        <span className="truncate max-w-[90px]">{app.customerName}</span>
                                        <div className="flex items-center gap-1">
                                          <span className={`text-[9px] font-bold px-1 rounded border ${waitModeMeta.bg} ${waitModeMeta.text} ${waitModeMeta.border}`}>
                                            {waitModeMeta.label}
                                          </span>
                                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                                            {statusMeta.label}
                                          </span>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}

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
        </>
      )}

      {/* ========================================================================= */}
      {/* B9. APPOINTMENT DETAIL DRAWER / MODAL                                     */}
      {/* ========================================================================= */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
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
                  {(() => {
                    const st = formatAppointmentStatus(selectedAppointment.status);
                    return (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${st.bg} ${st.text} ${st.border}`}>
                        {st.label}
                      </span>
                    );
                  })()}
                  {(() => {
                    const wm = formatCustomerWaitMode(selectedAppointment.customerWaitMode);
                    return (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${wm.bg} ${wm.text} ${wm.border}`}>
                        {wm.label}
                      </span>
                    );
                  })()}
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {selectedAppointment.serviceTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
                title="Cerrar detalle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs">
              {/* Horario, Duración y Modo de Estancia */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Horario</span>
                  <p className="font-black text-slate-900 text-sm font-mono mt-0.5">
                    {selectedAppointment.timeStr} – {selectedAppointment.endStr}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Duración</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">
                    {selectedAppointment.durationMinutes} min
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Estancia</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">
                    {selectedAppointment.customerWaitMode === 'WAIT_ON_SITE' ? 'Espera' : 'Deja el coche'}
                  </p>
                </div>
              </div>

              {/* Acciones Operativas según estado canónico */}
              {ALLOWED_OPERATIONAL_TRANSITIONS[selectedAppointment.status]?.length > 0 && (
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <span className="text-[11px] text-blue-900 font-extrabold uppercase tracking-wider block">
                    Gestión Operativa del Vehículo
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ALLOWED_OPERATIONAL_TRANSITIONS[selectedAppointment.status].map((action) => (
                      <button
                        key={action.nextStatus}
                        type="button"
                        disabled={statusUpdating === selectedAppointment.id}
                        onClick={() => handleUpdateAppointmentStatus(selectedAppointment, action.nextStatus)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
                          action.primary
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-extrabold'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                        } disabled:opacity-50`}
                      >
                        {statusUpdating === selectedAppointment.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>{action.label}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cliente Autorizado con acción a Directorio */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Cliente</span>
                  <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                    {selectedAppointment.customerName}
                  </p>
                  {selectedAppointment.customerPhone && (
                    <p className="text-slate-600 font-mono text-xs mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {selectedAppointment.customerPhone}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const custId = selectedAppointment.customerId || selectedAppointment.raw?.customer_id;
                    setSelectedAppointment(null);
                    if (custId) {
                      navigate(`/directorio?tab=clientes&customer=${encodeURIComponent(custId)}`);
                    } else {
                      navigate(`/directorio?tab=clientes&q=${encodeURIComponent(selectedAppointment.customerName)}`);
                    }
                  }}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[44px] w-full sm:w-auto"
                >
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Ver Ficha Cliente</span>
                </button>
              </div>

              {/* Vehículo con acción a Directorio */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Vehículo</span>
                  <div className="mt-1">
                    <SpanishPlateBadge plate={selectedAppointment.vehiclePlate} />
                  </div>
                  {selectedAppointment.vehicleInfo && (
                    <p className="text-slate-700 font-semibold text-xs mt-1">
                      {selectedAppointment.vehicleInfo}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const vehId = selectedAppointment.vehicleId || selectedAppointment.raw?.vehicle_id;
                    setSelectedAppointment(null);
                    if (vehId) {
                      navigate(`/directorio?tab=vehiculos&vehicle=${encodeURIComponent(vehId)}`);
                    } else {
                      navigate(`/directorio?tab=vehiculos&q=${encodeURIComponent(selectedAppointment.vehiclePlate)}`);
                    }
                  }}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[44px] w-full sm:w-auto"
                >
                  <Car className="w-4 h-4 text-emerald-600" />
                  <span>Ver Ficha Vehículo</span>
                </button>
              </div>

              {/* Síntomas Reportados */}
              {selectedAppointment.symptoms.length > 0 && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Síntomas Reportados</span>
                  <p className="text-slate-800 font-semibold">{selectedAppointment.symptoms.join(', ')}</p>
                </div>
              )}

              {/* Observaciones o Notas de Recepción */}
              {selectedAppointment.raw?.service_request?.notes && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Notas de Recepción</span>
                  <p className="text-slate-700 italic">{String(selectedAppointment.raw.service_request.notes)}</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetVehicleId = selectedAppointment.vehicleId || selectedAppointment.raw?.vehicle_id || '';
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
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer min-h-[44px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Presupuesto con RK</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetVehicleId = selectedAppointment.vehicleId || selectedAppointment.raw?.vehicle_id || '';
                    const targetCustomerId = selectedAppointment.customerId || selectedAppointment.raw?.customer_id || '';
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
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Presupuesto Manual</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition text-center cursor-pointer min-h-[44px]"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Manual Appointment Modal */}
      {(activeTenantId || isManualAppointmentModalOpen) && (
        <ManualAppointmentModal
          isOpen={isManualAppointmentModalOpen}
          onClose={() => setIsManualAppointmentModalOpen(false)}
          tenantId={activeTenantId}
          initialCustomerId={urlCustomerId}
          initialVehicleId={urlVehicleId}
          onAppointmentCreated={() => {
            if (activeTenantId) {
              loadRealAppointments(activeTenantId);
              if (effectiveWorkshopId) {
                loadCapacityData(activeTenantId, effectiveWorkshopId);
              }
            }
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
