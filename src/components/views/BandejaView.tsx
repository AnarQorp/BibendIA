import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from '../../router/RouterContext';
import { useDemo } from '../../context/DemoContext';
import {
  Inbox,
  Plus,
  Phone,
  MessageSquare,
  Globe,
  Clock,
  User,
  Car,
  Calendar,
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ArrowRight,
  Truck,
  Shield,
  Filter,
  Check,
  History,
  Info,
  ExternalLink
} from 'lucide-react';
import {
  listReceptionCases,
  getReceptionCase,
  updateReceptionCase,
  getReceptionCaseHistory,
  type ReceptionCase,
  type ReceptionCaseCallerType,
  type ReceptionCaseCategory,
  type ReceptionCasePriority,
  type ReceptionCaseStatus,
  type ReceptionCaseChannel,
  type ReceptionCaseAuditEvent
} from '../../services/receptionCases';
import {
  listWorkshopCustomers,
  listWorkshopVehicles,
} from '../../services/workshopOperations';
import type { WorkshopCustomer, WorkshopVehicle } from '../../types';
import { SpanishPlateBadge } from './DirectorioView';
import { ManualReceptionCaseModal } from './ManualReceptionCaseModal';
import { getWorkshopTenantId } from '../../services/workshopAppointments';

export interface BandejaViewProps {
  tenantId?: string | null;
}

const CALLER_TYPE_LABELS: Record<ReceptionCaseCallerType, { label: string; icon: string; bg: string; text: string }> = {
  CUSTOMER: { label: 'Cliente', icon: '👤', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  SUPPLIER: { label: 'Proveedor', icon: '🚚', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  TOW_TRANSPORT: { label: 'Grúa / Transporte', icon: '🪝', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800' },
  INSURER_ASSESSOR: { label: 'Perito / Seguros', icon: '📋', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800' },
  RENTING_FLEET: { label: 'Flota / Renting', icon: '🏢', bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-800' },
  OTHER_WORKSHOP: { label: 'Otro Taller', icon: '🔧', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800' },
  COMMERCIAL: { label: 'Comercial', icon: '💼', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700' },
  OTHER: { label: 'Otro', icon: '📌', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700' },
};

const CATEGORY_LABELS: Record<ReceptionCaseCategory, string> = {
  callback_request: 'Solicitud de llamada',
  appointment_issue: 'Cita / Horario',
  late_arrival: 'Llegada con retraso',
  vehicle_status_question: 'Estado del vehículo',
  estimate_question: 'Presupuesto',
  additional_vehicle_issue: 'Avería adicional',
  supplier_message: 'Mensaje de proveedor',
  parts_delivery: 'Entrega de recambios',
  tow_delivery: 'Llegada de grúa',
  insurance_assessor: 'Peritaje',
  administration_invoice: 'Facturación / Admin',
  missed_call_return: 'Llamada perdida devuelta',
  commercial: 'Comercial',
  other: 'General',
};

const PRIORITY_BADGES: Record<ReceptionCasePriority, { label: string; badgeClass: string }> = {
  URGENT: { label: 'Urgente', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold animate-pulse' },
  HIGH: { label: 'Alta', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold' },
  NORMAL: { label: 'Normal', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  LOW: { label: 'Baja', badgeClass: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const STATUS_LABELS: Record<ReceptionCaseStatus, { label: string; badgeClass: string }> = {
  OPEN: { label: 'Abierto', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-bold' },
  IN_PROGRESS: { label: 'En curso', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold' },
  WAITING_WORKSHOP: { label: 'Acción Taller', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-bold' },
  WAITING_CUSTOMER: { label: 'Espera Cliente', badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200 font-semibold' },
  RESOLVED: { label: 'Resuelto', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold' },
  CLOSED: { label: 'Cerrado', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'hace un momento';
    if (diffMinutes === 1) return 'hace 1 min';
    if (diffMinutes < 60) return `hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return 'hace 1 h';
    if (diffHours < 24) return `hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'ayer';
    if (diffDays < 7) return `hace ${diffDays} d`;
    return new Date(isoString).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch {
    return 'reciente';
  }
}

export const BandejaView: React.FC<BandejaViewProps> = ({ tenantId: propTenantId }) => {
  const { searchParams, navigate } = useRouter();
  const { setActiveSection } = useDemo();

  // Tenant resolution
  const activeTenantId = useMemo(() => {
    if (propTenantId) return propTenantId;
    const resolved = getWorkshopTenantId();
    if (resolved) return resolved;
    if (typeof window !== 'undefined') {
      const fromUrl = searchParams.get('tenant');
      if (fromUrl) return fromUrl;
      const stored = localStorage.getItem('bibendia_tenant_id');
      if (stored) return stored;
    }
    return '';
  }, [propTenantId, searchParams]);

  // View & Filter states
  const [statusFilterGroup, setStatusFilterGroup] = useState<'pending' | 'all' | 'resolved'>('pending');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | ReceptionCasePriority>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | ReceptionCaseChannel>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ReceptionCaseCategory>('ALL');

  // Cases state
  const [cases, setCases] = useState<ReceptionCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCorrelationId, setErrorCorrelationId] = useState<string | null>(null);

  // Selected case state
  const urlCaseId = searchParams.get('case');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(urlCaseId || null);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<ReceptionCase | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [caseHistory, setCaseHistory] = useState<ReceptionCaseAuditEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Entities lookup caches for clean display
  const [customersMap, setCustomersMap] = useState<Record<string, WorkshopCustomer>>({});
  const [vehiclesMap, setVehiclesMap] = useState<Record<string, WorkshopVehicle>>({});

  // Mobile navigation tab ('list' | 'detail')
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');

  // Modal creation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [mutationFeedback, setMutationFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch Cases from canonical API
  const loadCases = useCallback(async () => {
    if (!activeTenantId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setErrorCorrelationId(null);

    try {
      const res = await listReceptionCases(activeTenantId, { limit: 100 });
      if (res.status === 'success' && res.data) {
        setCases(res.data);
      } else {
        setErrorMessage(res.message || 'Error al cargar la bandeja de recepción.');
        setErrorCorrelationId(res.correlationId || null);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error de red.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Load customer and vehicle directories to resolve names & plates
  useEffect(() => {
    if (!activeTenantId) return;
    listWorkshopCustomers(activeTenantId, { limit: 100 }).then(res => {
      if (res.status === 'success' && res.data) {
        const m: Record<string, WorkshopCustomer> = {};
        for (const c of res.data) m[c.id] = c;
        setCustomersMap(m);
      }
    }).catch(() => {});

    listWorkshopVehicles(activeTenantId, { limit: 100 }).then(res => {
      if (res.status === 'success' && res.data) {
        const m: Record<string, WorkshopVehicle> = {};
        for (const v of res.data) m[v.id] = v;
        setVehiclesMap(m);
      }
    }).catch(() => {});
  }, [activeTenantId]);

  // Filter cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      // 1. Status group filter
      if (statusFilterGroup === 'pending') {
        const isPending = ['OPEN', 'IN_PROGRESS', 'WAITING_WORKSHOP', 'WAITING_CUSTOMER'].includes(c.status);
        if (!isPending) return false;
      } else if (statusFilterGroup === 'resolved') {
        const isResolved = ['RESOLVED', 'CLOSED'].includes(c.status);
        if (!isResolved) return false;
      }
      // 2. Priority filter
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;
      // 3. Channel filter
      if (channelFilter !== 'ALL' && c.channel !== channelFilter) return false;
      // 4. Category filter
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;

      return true;
    });
  }, [cases, statusFilterGroup, priorityFilter, channelFilter, categoryFilter]);

  // Auto-select first case if none selected, or select from url
  useEffect(() => {
    if (selectedCaseId) {
      const found = cases.find(c => c.id === selectedCaseId);
      if (found) {
        setSelectedCaseDetail(found);
      }
    } else if (filteredCases.length > 0 && !selectedCaseId) {
      setSelectedCaseId(filteredCases[0].id);
      setSelectedCaseDetail(filteredCases[0]);
    }
  }, [cases, selectedCaseId, filteredCases]);

  // Fail-closed audit history loader: distinguishes loading, empty, and error
  const loadCaseHistory = useCallback(async (tenantId: string, caseId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await getReceptionCaseHistory(tenantId, caseId);
      if (res.status === 'success' && res.data) {
        setCaseHistory(res.data);
      } else {
        setCaseHistory([]);
        setHistoryError(res.message || 'Error al obtener historial de auditoría.');
      }
    } catch (err: any) {
      setCaseHistory([]);
      setHistoryError(err?.message || 'Error de conexión al obtener historial.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // When selectedCaseId changes, load case detail & real audit history
  useEffect(() => {
    if (!selectedCaseId || !activeTenantId) {
      setCaseHistory([]);
      setHistoryError(null);
      return;
    }
    let isMounted = true;
    setIsDetailLoading(true);
    getReceptionCase(activeTenantId, selectedCaseId).then(res => {
      if (!isMounted) return;
      if (res.status === 'success' && res.data) {
        setSelectedCaseDetail(res.data);
      }
      setIsDetailLoading(false);
    }).catch(() => {
      if (isMounted) setIsDetailLoading(false);
    });

    loadCaseHistory(activeTenantId, selectedCaseId);

    return () => { isMounted = false; };
  }, [selectedCaseId, activeTenantId, loadCaseHistory]);

  // Select case handler
  const handleSelectCase = (caseItem: ReceptionCase) => {
    setSelectedCaseId(caseItem.id);
    setSelectedCaseDetail(caseItem);
    setMobileTab('detail');
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set('case', caseItem.id);
      window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`);
    } catch {}
  };

  // Status transition mutation
  const handleUpdateStatus = async (newStatus: ReceptionCaseStatus) => {
    if (!selectedCaseId || !activeTenantId) return;
    setMutationFeedback(null);
    try {
      const res = await updateReceptionCase(activeTenantId, selectedCaseId, { status: newStatus });
      if (res.status === 'success' && res.data) {
        const updated = res.data;
        setSelectedCaseDetail(updated);
        setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
        setMutationFeedback({ type: 'success', text: `Estado actualizado a ${STATUS_LABELS[newStatus].label}.` });
        // Reload audit history
        loadCaseHistory(activeTenantId, selectedCaseId);
      } else {
        setMutationFeedback({ type: 'error', text: res.message || 'Error al actualizar estado.' });
      }
    } catch (err) {
      setMutationFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Error de red.' });
    }
  };

  // Priority mutation
  const handleUpdatePriority = async (newPriority: ReceptionCasePriority) => {
    if (!selectedCaseId || !activeTenantId) return;
    setMutationFeedback(null);
    try {
      const res = await updateReceptionCase(activeTenantId, selectedCaseId, { priority: newPriority });
      if (res.status === 'success' && res.data) {
        const updated = res.data;
        setSelectedCaseDetail(updated);
        setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
        setMutationFeedback({ type: 'success', text: `Prioridad cambiada a ${PRIORITY_BADGES[newPriority].label}.` });
        // Reload audit history
        loadCaseHistory(activeTenantId, selectedCaseId);
      } else {
        setMutationFeedback({ type: 'error', text: res.message || 'Error al actualizar prioridad.' });
      }
    } catch (err) {
      setMutationFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Error de red.' });
    }
  };

  // Navigation helpers to related entities
  const goToEntity = (type: 'customer' | 'vehicle' | 'appointment' | 'estimate', id: string) => {
    if (type === 'customer') {
      setActiveSection('directorio');
      navigate(`/directorio?tab=clientes&customer=${encodeURIComponent(id)}`);
    } else if (type === 'vehicle') {
      setActiveSection('directorio');
      navigate(`/directorio?tab=vehiculos&vehicle=${encodeURIComponent(id)}`);
    } else if (type === 'appointment') {
      setActiveSection('agenda');
      navigate(`/agenda?appointment=${encodeURIComponent(id)}`);
    } else if (type === 'estimate') {
      setActiveSection('presupuestos');
      navigate(`/presupuestos?selected=${encodeURIComponent(id)}`);
    }
  };

  // Case counts for tabs
  const pendingCount = useMemo(() => {
    return cases.filter(c => ['OPEN', 'IN_PROGRESS', 'WAITING_WORKSHOP', 'WAITING_CUSTOMER'].includes(c.status)).length;
  }, [cases]);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5 animate-fadeIn min-h-0 overflow-x-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Bandeja Inteligente
              </h2>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-2xs">
                  {pendingCount} pendientes
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Todo lo que BibendIA no resuelve solo se convierte en trabajo visible para el taller
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadCases()}
            disabled={isLoading}
            className="p-2 sm:px-3 sm:py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Refrescar bandeja"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Nuevo asunto</span>
          </button>
        </div>
      </div>

      {/* State Failure Banner (FAIL-CLOSED: Never show empty fake list when backend fails) */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Error al consultar la Bandeja de Recepción</span>
            </div>
            <button
              onClick={() => loadCases()}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition"
            >
              Reintentar
            </button>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">{errorMessage}</p>
          {errorCorrelationId && (
            <p className="text-[11px] font-mono text-rose-600">ID Correlación: {errorCorrelationId}</p>
          )}
        </div>
      )}

      {/* Filter Tabs Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        {/* Status Group Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilterGroup('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                statusFilterGroup === 'pending'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>Requieren Atención</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                statusFilterGroup === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {pendingCount}
              </span>
            </button>

            <button
              onClick={() => setStatusFilterGroup('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusFilterGroup === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todos ({cases.length})
            </button>

            <button
              onClick={() => setStatusFilterGroup('resolved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusFilterGroup === 'resolved'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Resueltos / Cerrados ({cases.length - pendingCount})
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Mostrando {filteredCases.length} de {cases.length} asuntos
          </span>
        </div>

        {/* Granular Secondary Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filtros:
          </span>

          {/* Priority Select */}
          <select
            data-testid="filter-priority-select"
            aria-label="Filtrar por prioridad"
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs font-medium focus:outline-none focus:border-blue-500 shrink-0"
          >
            <option value="ALL">Prioridad: Todas</option>
            <option value="URGENT">Urgente</option>
            <option value="HIGH">Alta</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Baja</option>
          </select>

          {/* Channel Select */}
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs font-medium focus:outline-none focus:border-blue-500 shrink-0"
          >
            <option value="ALL">Canal: Todos</option>
            <option value="PHONE">Teléfono / Voz IA</option>
            <option value="MANUAL">Manual de Taller</option>
            <option value="WEB">Web</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>

          {/* Category Select */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs font-medium focus:outline-none focus:border-blue-500 shrink-0"
          >
            <option value="ALL">Categoría: Todas</option>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>

          {(priorityFilter !== 'ALL' || channelFilter !== 'ALL' || categoryFilter !== 'ALL') && (
            <button
              onClick={() => {
                setPriorityFilter('ALL');
                setChannelFilter('ALL');
                setCategoryFilter('ALL');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold shrink-0 ml-1"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 min-h-0">
        {/* Left Column (5 cols on lg): Cases List */}
        <div className={`bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs lg:col-span-5 ${
          mobileTab === 'list' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Asuntos</span>
              <span className="text-[11px] font-mono text-slate-400">({filteredCases.length})</span>
            </h3>
            {isLoading && (
              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[70dvh] lg:max-h-[calc(100dvh-17rem)]">
            {isLoading && cases.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-slate-500 font-medium">Consultando bandeja de recepción...</p>
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="p-10 text-center space-y-2.5">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Bandeja al día</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {statusFilterGroup === 'pending'
                    ? 'No hay asuntos pendientes de atención para los filtros seleccionados.'
                    : 'No se encontraron asuntos para esta vista.'}
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear nuevo asunto</span>
                </button>
              </div>
            ) : (
              filteredCases.map(caseItem => {
                const isSelected = caseItem.id === selectedCaseId;
                const callerConfig = CALLER_TYPE_LABELS[caseItem.callerType] || CALLER_TYPE_LABELS.OTHER;
                const priorityConfig = PRIORITY_BADGES[caseItem.priority] || PRIORITY_BADGES.NORMAL;
                const statusConfig = STATUS_LABELS[caseItem.status] || STATUS_LABELS.OPEN;
                const customer = caseItem.customerId ? customersMap[caseItem.customerId] : null;
                const vehicle = caseItem.vehicleId ? vehiclesMap[caseItem.vehicleId] : null;
                const isCallback = caseItem.category === 'callback_request';

                return (
                  <button
                    key={caseItem.id}
                    onClick={() => handleSelectCase(caseItem)}
                    className={`w-full text-left p-3.5 sm:p-4 transition-all flex flex-col gap-2 relative border-l-4 ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-blue-600 shadow-2xs'
                        : isCallback
                        ? 'bg-amber-50/30 hover:bg-amber-50/60 border-l-amber-400'
                        : 'hover:bg-slate-50/70 border-l-transparent'
                    }`}
                  >
                    {/* Header Row: Caller Type & Time Ago */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${callerConfig.bg} ${callerConfig.text}`}>
                          <span>{callerConfig.icon}</span>
                          <span>{customer?.name || callerConfig.label}</span>
                        </span>

                        {vehicle && (
                          <SpanishPlateBadge plate={vehicle.plate} className="text-[10px]" />
                        )}

                        {isCallback && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wide bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" /> Callback
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {formatTimeAgo(caseItem.createdAt)}
                      </span>
                    </div>

                    {/* Summary (What they want) */}
                    <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      “{caseItem.summary}”
                    </p>

                    {/* Footer Row: Channel, Category, Priority, Status */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/80 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-500 truncate">
                        <span className="font-medium text-slate-600">{CATEGORY_LABELS[caseItem.category] || caseItem.category}</span>
                        <span>·</span>
                        <span className="truncate">{caseItem.channel === 'PHONE' ? 'Teléfono / Voz' : caseItem.channel === 'MANUAL' ? 'Manual' : caseItem.channel}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {caseItem.priority !== 'NORMAL' && (
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${priorityConfig.badgeClass}`}>
                            {priorityConfig.label}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] ${statusConfig.badgeClass}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (7 cols on lg): Active Case Detail */}
        <div className={`bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs lg:col-span-7 ${
          mobileTab === 'detail' ? 'flex' : 'hidden lg:flex'
        }`}>
          {selectedCaseDetail ? (
            <div className="flex flex-col h-full overflow-y-auto divide-y divide-slate-100">
              {/* Detail Top Header */}
              <div className="p-4 sm:p-5 bg-slate-50/70 space-y-3">
                {/* Mobile Back Button */}
                <div className="flex items-center justify-between lg:hidden pb-2 border-b border-slate-200/80">
                  <button
                    onClick={() => setMobileTab('list')}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition flex items-center gap-1 text-xs font-bold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Volver a la bandeja</span>
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {STATUS_LABELS[selectedCaseDetail.status]?.label}
                  </span>
                </div>

                {mutationFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                    mutationFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                      : 'bg-rose-50 text-rose-800 border-rose-200 font-semibold'
                  }`}>
                    <span>{mutationFeedback.text}</span>
                    <button onClick={() => setMutationFeedback(null)} className="text-slate-400 hover:text-slate-600">
                      ×
                    </button>
                  </div>
                )}

                {/* Metadata Row */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                      CALLER_TYPE_LABELS[selectedCaseDetail.callerType]?.bg || 'bg-slate-100'
                    } ${CALLER_TYPE_LABELS[selectedCaseDetail.callerType]?.text || 'text-slate-800'}`}>
                      <span>{CALLER_TYPE_LABELS[selectedCaseDetail.callerType]?.icon}</span>
                      <span>{CALLER_TYPE_LABELS[selectedCaseDetail.callerType]?.label}</span>
                    </span>

                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg">
                      {CATEGORY_LABELS[selectedCaseDetail.category] || selectedCaseDetail.category}
                    </span>

                    <span className="text-xs font-medium px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg">
                      {selectedCaseDetail.channel === 'PHONE' ? '📞 Teléfono / Voz IA' : selectedCaseDetail.channel === 'MANUAL' ? '🛠 Manual' : selectedCaseDetail.channel}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    Registrado {new Date(selectedCaseDetail.createdAt).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* Summary Title */}
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                    {selectedCaseDetail.summary}
                  </h3>
                </div>

                {/* Status & Priority Control Panel (Easy Workshop Actions) */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Status Workflow Selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Estado del Asunto:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(['OPEN', 'IN_PROGRESS', 'WAITING_WORKSHOP', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as ReceptionCaseStatus[]).map(st => {
                        const isCurrent = selectedCaseDetail.status === st;
                        return (
                          <button
                            key={st}
                            data-testid={`status-btn-${st}`}
                            onClick={() => handleUpdateStatus(st)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              isCurrent
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isCurrent && <Check className="w-3 h-3 inline mr-1 stroke-[3]" />}
                            {STATUS_LABELS[st].label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Selector */}
                  <div className="space-y-1 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Prioridad:
                    </span>
                    <select
                      data-testid="detail-priority-select"
                      aria-label="Prioridad del asunto"
                      value={selectedCaseDetail.priority}
                      onChange={e => handleUpdatePriority(e.target.value as ReceptionCasePriority)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      <option value="LOW">Baja</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">Alta</option>
                      <option value="URGENT">Urgente</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Callback Request Highlight Banner */}
              {selectedCaseDetail.category === 'callback_request' && (
                <div className="p-4 sm:p-5 bg-amber-50/60 border-y border-amber-200/70 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-2xs">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-amber-950">Solicitud de Llamada Pendiente</h4>
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold uppercase">
                          Atención Humana
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Este interlocutor solicitó expresamente que el taller le llame. Abrir esta ficha no marca la llamada como atendida.
                      </p>
                    </div>
                  </div>

                  {/* Contact Data derived from canonical decryption / customer */}
                  <div className="bg-white/90 border border-amber-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Interlocutor</span>
                      <p className="font-bold text-slate-900">
                        {selectedCaseDetail.contactContext?.contactPerson ||
                         (selectedCaseDetail.customerId ? customersMap[selectedCaseDetail.customerId]?.name : null) ||
                         'Contacto telefónico'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Teléfono de contacto</span>
                      <p className="font-mono font-bold text-blue-700 text-sm">
                        {selectedCaseDetail.contactContext?.phone ||
                         (selectedCaseDetail.customerId ? customersMap[selectedCaseDetail.customerId]?.phone : null) ||
                         'Número no registrado'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hora de llamada</span>
                      <p className="text-slate-600">
                        {formatTimeAgo(selectedCaseDetail.createdAt)}
                      </p>
                    </div>

                    {selectedCaseDetail.status !== 'RESOLVED' && selectedCaseDetail.status !== 'CLOSED' && (
                      <button
                        onClick={() => handleUpdateStatus('RESOLVED')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Marcar llamada realizada</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Detail Text Body */}
              {selectedCaseDetail.detail && (
                <div className="p-4 sm:p-5 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Detalles y Notas del Asunto
                  </h4>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedCaseDetail.detail}
                  </div>
                </div>
              )}

              {/* Non-Customer Interlocutor Information */}
              {selectedCaseDetail.callerType !== 'CUSTOMER' && (
                <div className="p-4 sm:p-5 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Datos del Interlocutor (No cliente)
                  </h4>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{CALLER_TYPE_LABELS[selectedCaseDetail.callerType]?.icon}</span>
                      <div>
                        <p className="font-bold text-slate-900">{CALLER_TYPE_LABELS[selectedCaseDetail.callerType]?.label}</p>
                        <p className="text-slate-500">
                          {selectedCaseDetail.contactContext?.contactPerson || 'Gestión externa del taller sin cliente asociado'}
                        </p>
                      </div>
                    </div>
                    {selectedCaseDetail.contactContext?.phone && (
                      <span className="font-mono text-slate-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {selectedCaseDetail.contactContext.phone}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Related Canonical Entities (Clickable Direct Links) */}
              <div className="p-4 sm:p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Entidades Relacionadas en el Taller
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Related Customer */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Cliente</span>
                        <p className="font-bold text-slate-900 truncate">
                          {selectedCaseDetail.customerId ? (customersMap[selectedCaseDetail.customerId]?.name || 'Cliente registrado') : 'Sin cliente asignado'}
                        </p>
                      </div>
                    </div>
                    {selectedCaseDetail.customerId && (
                      <button
                        onClick={() => goToEntity('customer', selectedCaseDetail.customerId!)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-blue-600 border border-slate-200 rounded-lg font-bold text-[11px] transition shrink-0 flex items-center gap-1"
                        title="Abrir ficha de cliente en Directorio"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Related Vehicle */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Car className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Vehículo</span>
                        <p className="font-bold text-slate-900 truncate">
                          {selectedCaseDetail.vehicleId ? (vehiclesMap[selectedCaseDetail.vehicleId]?.plate || 'Vehículo registrado') : 'Sin vehículo asignado'}
                        </p>
                      </div>
                    </div>
                    {selectedCaseDetail.vehicleId && (
                      <button
                        onClick={() => goToEntity('vehicle', selectedCaseDetail.vehicleId!)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-blue-600 border border-slate-200 rounded-lg font-bold text-[11px] transition shrink-0 flex items-center gap-1"
                        title="Abrir ficha del vehículo en Directorio"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Related Appointment */}
                  {selectedCaseDetail.appointmentId && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between sm:col-span-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Cita de Taller</span>
                          <p className="font-bold text-slate-900 truncate">Cita vinculada en Agenda</p>
                        </div>
                      </div>
                      <button
                        onClick={() => goToEntity('appointment', selectedCaseDetail.appointmentId!)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg font-bold text-[11px] transition shrink-0 flex items-center gap-1"
                      >
                        <span>Ver en Agenda</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Related Estimate */}
                  {selectedCaseDetail.estimateId && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between sm:col-span-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Presupuesto</span>
                          <p className="font-bold text-slate-900 truncate">Borrador de presupuesto vinculado</p>
                        </div>
                      </div>
                      <button
                        onClick={() => goToEntity('estimate', selectedCaseDetail.estimateId!)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-purple-600 border border-slate-200 rounded-lg font-bold text-[11px] transition shrink-0 flex items-center gap-1"
                      >
                        <span>Ver Presupuesto</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Provenance Context (Operational & Safe) */}
              <div className="p-4 sm:p-5 space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Origen y Trazabilidad Operativa
                </h4>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                  <p>
                    <strong className="text-slate-800">Canal de captura:</strong>{' '}
                    {selectedCaseDetail.channel === 'PHONE' ? 'Atención telefónica por voz (ElevenLabs Voice Agent)' :
                     selectedCaseDetail.channel === 'MANUAL' ? 'Registro manual por personal de taller' : selectedCaseDetail.channel}
                  </p>
                  {selectedCaseDetail.providerConversationId && (
                    <p className="font-mono text-[11px] text-slate-500">
                      ID Conversación de voz: {selectedCaseDetail.providerConversationId}
                    </p>
                  )}
                </div>
              </div>

              {/* Real Audit History Trail */}
              <div className="p-4 sm:p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Historial Real de Cambios
                </h4>

                {historyLoading ? (
                  <div className="p-4 text-center text-xs text-slate-400" data-testid="history-loading">
                    Consultando registro de auditoría...
                  </div>
                ) : historyError ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-2" data-testid="history-error">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{historyError}</span>
                    </div>
                    <button
                      onClick={() => loadCaseHistory(activeTenantId, selectedCaseDetail.id)}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shrink-0"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : caseHistory.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500" data-testid="history-empty">
                    Sin eventos de auditoría disponibles
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="history-list">
                    {caseHistory.map((ev, idx) => (
                      <div key={ev.id || idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <span className="font-bold text-slate-800">
                            {ev.eventType === 'reception_case.created' ? 'Asunto creado' :
                             ev.eventType === 'reception_case.updated' ? 'Actualización de estado o prioridad' :
                             ev.eventType === 'reception_case.completed' ? 'Asunto completado/resuelto' : ev.eventType}
                          </span>
                          <span className="text-[11px] text-slate-400">({ev.actorType})</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(ev.occurredAt).toLocaleString('es-ES', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3 min-h-[300px]">
              <Inbox className="w-12 h-12 text-slate-300 stroke-[1.5]" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">Ningún asunto seleccionado</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Selecciona cualquier caso de la columna izquierda para revisar sus detalles, notas y gestionar el estado.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Creation Modal */}
      <ManualReceptionCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        tenantId={activeTenantId}
        onCaseCreated={(newCase) => {
          setCases(prev => [newCase, ...prev]);
          handleSelectCase(newCase);
        }}
      />
    </div>
  );
};
