import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Mail,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Clock,
  Wrench,
  X
} from 'lucide-react';
import {
  fetchPlatformWorkshopsDirectory,
  createPlatformTenant,
  mutateTenantLifecycle,
  type PlatformWorkshopsDirectoryState,
} from '../../../services/platformAdmin';
import type { PlatformWorkshopDirectoryItem, WorkshopPlan } from '../../../types';

export interface WorkshopManagementViewProps {
  onNavigateToInvitations?: (tenantId?: string) => void;
  onSelectTenant?: (tenantId: string) => void;
}

export const WorkshopManagementView: React.FC<WorkshopManagementViewProps> = ({
  onNavigateToInvitations,
  onSelectTenant,
}) => {
  const [directoryState, setDirectoryState] = useState<PlatformWorkshopsDirectoryState>({ status: 'idle' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Selected workshop for Detail Ficha Modal/Drawer
  const [selectedWorkshop, setSelectedWorkshop] = useState<PlatformWorkshopDirectoryItem | null>(null);

  // Create Workshop Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkshopName, setNewWorkshopName] = useState('');
  const [newWorkshopSlug, setNewWorkshopSlug] = useState('');
  const [newWorkshopPlan, setNewWorkshopPlan] = useState<WorkshopPlan>('pilot');
  const [newWorkshopMode, setNewWorkshopMode] = useState<'pilot_supervised' | 'standard'>('pilot_supervised');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Lifecycle mutation action state
  const [mutationReason, setMutationReason] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const res = await fetchPlatformWorkshopsDirectory({
      search: searchTerm.trim() || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      plan: planFilter !== 'all' ? planFilter : undefined,
    });
    setDirectoryState(res);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, planFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Auto-slug generator
  const handleNameChange = (val: string) => {
    setNewWorkshopName(val);
    const slug = val
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setNewWorkshopSlug(slug);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newWorkshopName.trim()) {
      setCreateError('El nombre del taller es obligatorio');
      return;
    }
    setIsCreating(true);
    const idempotencyKey = `create-tenant:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
    const res = await createPlatformTenant({
      name: newWorkshopName.trim(),
      plan: newWorkshopPlan,
      operatingMode: newWorkshopMode,
      idempotencyKey,
    });

    setIsCreating(false);
    if (!res.ok) {
      setCreateError(res.message || 'Error al crear el taller');
      return;
    }

    setIsCreateModalOpen(false);
    setNewWorkshopName('');
    setNewWorkshopSlug('');
    setNewWorkshopPlan('pilot');
    loadData();
  };

  const handleLifecycleChange = async (target: 'active' | 'suspended') => {
    if (!selectedWorkshop) return;
    if (target === 'suspended' && !mutationReason.trim()) {
      setMutationError('Debes indicar un motivo para suspender el taller.');
      return;
    }
    setIsMutating(true);
    setMutationError(null);
    const idempotencyKey = `mutate-lifecycle:${selectedWorkshop.tenant_id}:${Date.now()}`;
    const res = await mutateTenantLifecycle(selectedWorkshop.tenant_id, {
      target,
      reason: mutationReason.trim() || `Transición operativa a ${target} desde panel de administración`,
      expectedVersion: selectedWorkshop.tenant_version,
      idempotencyKey,
    });

    setIsMutating(false);
    if (!res.ok) {
      setMutationError(res.message || 'Error al cambiar estado operativo');
      return;
    }

    setMutationReason('');
    setSelectedWorkshop(null);
    loadData();
  };

  const workshops = directoryState.data || [];

  const getPlanBadge = (plan: WorkshopPlan) => {
    switch (plan) {
      case 'pilot':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">Plan Piloto</span>;
      case 'professional':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">Profesional</span>;
      case 'standard':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">Estándar</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">Básico</span>;
    }
  };

  const getStatusBadge = (status: string, killSwitch: boolean) => {
    if (killSwitch) {
      return (
        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
          <ShieldAlert className="w-3 h-3 text-red-600" /> KILL-SWITCH ACTIVO
        </span>
      );
    }
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVO
          </span>
        );
      case 'pilot':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-amber-600" /> EN PILOTO
          </span>
        );
      case 'provisioning':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-sky-600" /> PROVISIÓN
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <XCircle className="w-3 h-3 text-rose-600" /> SUSPENDIDO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Gestión Operativa de Talleres</h2>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              {workshops.length} talleres registrados
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Directorio maestro de talleres BibendIA. Consulta el estado operativo, asigna planes, gestiona el ciclo de vida y emite invitaciones de acceso.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-300 disabled:opacity-50"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Taller</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, slug o tenant ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="pilot">En Piloto</option>
              <option value="provisioning">En Provisión</option>
              <option value="suspended">Suspendido</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Todos los planes</option>
              <option value="pilot">Plan Piloto</option>
              <option value="basic">Básico</option>
              <option value="standard">Estándar</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
      </div>

      {/* Workshops Directory List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Taller & Identificador</th>
                <th className="py-3 px-4">Plan Asignado</th>
                <th className="py-3 px-4">Estado Operativo</th>
                <th className="py-3 px-4">Equipo & Accesos</th>
                <th className="py-3 px-4">Fecha Alta</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workshops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No se encontraron talleres con los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                workshops.map((w) => (
                  <tr key={w.id || (w as any).workshop_id} className="hover:bg-slate-50/80 transition group">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{w.name || (w as any).workshop_name || w.tenant_name}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 flex items-center gap-2 pt-0.5">
                        <span>slug: {w.slug || w.tenant_name}</span>
                        <span>•</span>
                        <span title={w.tenant_id}>id: {w.tenant_id.slice(0, 8)}...</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getPlanBadge(w.tenant_plan)}
                    </td>

                    <td className="py-3.5 px-4">
                      {getStatusBadge(w.lifecycle_status, w.kill_switch_enabled)}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3 text-slate-700">
                        <span className="flex items-center gap-1 font-mono text-[11px]" title="Miembros activos con rol asignado">
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          <strong>{w.member_count}</strong> activos
                        </span>
                        {(w.pending_invitations_count ?? 0) > 0 && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="Invitaciones pendientes de aceptación">
                            <Mail className="w-3 h-3 text-amber-500" />
                            <strong>{w.pending_invitations_count}</strong> pend.
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            if (onSelectTenant) onSelectTenant(w.tenant_id);
                            if (onNavigateToInvitations) onNavigateToInvitations(w.tenant_id);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-bold text-[11px] rounded-lg transition border border-slate-200 flex items-center gap-1"
                          title="Enviar invitación a este taller"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Invitar</span>
                        </button>

                        <button
                          onClick={() => setSelectedWorkshop(w)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg transition border border-blue-200 flex items-center gap-1"
                        >
                          <span>Ficha</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Ficha del Taller */}
      {selectedWorkshop && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Ficha de Taller</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedWorkshop(null);
                  setMutationError(null);
                  setMutationReason('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div>
                <h4 className="text-base font-extrabold text-slate-900">{selectedWorkshop.name}</h4>
                <p className="text-slate-500 font-mono text-[11px]">slug: {selectedWorkshop.slug}</p>
              </div>

              {/* Badges row */}
              <div className="flex items-center gap-2 pt-1">
                {getPlanBadge(selectedWorkshop.tenant_plan)}
                {getStatusBadge(selectedWorkshop.lifecycle_status, selectedWorkshop.kill_switch_enabled)}
              </div>

              {/* Data Grid */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenant ID:</span>
                  <span className="text-slate-900 font-bold select-all">{selectedWorkshop.tenant_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Workshop ID:</span>
                  <span className="text-slate-900 select-all">{selectedWorkshop.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Modo de Operación:</span>
                  <span className="text-slate-900">{selectedWorkshop.operating_mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Miembros Activos:</span>
                  <span className="text-slate-900">{selectedWorkshop.member_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invitaciones Pendientes:</span>
                  <span className="text-slate-900">{selectedWorkshop.pending_invitations_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Versión Control:</span>
                  <span className="text-slate-900">v{selectedWorkshop.tenant_version}</span>
                </div>
              </div>

              {/* Operational Control Section */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Acciones Operativas</h5>

                {mutationError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{mutationError}</span>
                  </div>
                )}

                {selectedWorkshop.lifecycle_status === 'suspended' ? (
                  <div className="space-y-2">
                    <p className="text-slate-500">El taller se encuentra actualmente suspendido.</p>
                    <button
                      onClick={() => handleLifecycleChange('active')}
                      disabled={isMutating}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isMutating ? 'Reactivando...' : 'Reactivar Taller'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-slate-700 font-medium text-[11px]">
                      Motivo de suspensión (requerido si deseas suspender):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Mantenimiento, fin de piloto, solicitud del taller..."
                      value={mutationReason}
                      onChange={(e) => setMutationReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-red-500"
                    />
                    <div className="flex gap-2 pt-1">
                      {selectedWorkshop.lifecycle_status === 'provisioning' && (
                        <button
                          onClick={() => handleLifecycleChange('active')}
                          disabled={isMutating}
                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Activar Taller</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleLifecycleChange('suspended')}
                        disabled={isMutating || !mutationReason.trim()}
                        className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Suspender Taller</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  const tenantId = selectedWorkshop.tenant_id;
                  setSelectedWorkshop(null);
                  if (onSelectTenant) onSelectTenant(tenantId);
                  if (onNavigateToInvitations) onNavigateToInvitations(tenantId);
                }}
                className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>+ Enviar Invitación de Acceso</span>
              </button>

              <button
                onClick={() => setSelectedWorkshop(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear Nuevo Taller */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Crear Nuevo Taller</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <p className="text-slate-500">
                Aprovisiona un nuevo taller en la plataforma BibendIA con su tenant y sede principal. La invitación de acceso para el responsable se emitirá de forma independiente tras su revisión.
              </p>

              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Nombre comercial del taller:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Taller Arkaitz Motor"
                  value={newWorkshopName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Identificador de URL (Slug):</label>
                <input
                  type="text"
                  required
                  placeholder="ej: taller-arkaitz-motor"
                  value={newWorkshopSlug}
                  onChange={(e) => setNewWorkshopSlug(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">Plan asignado:</label>
                  <select
                    value={newWorkshopPlan}
                    onChange={(e) => setNewWorkshopPlan(e.target.value as WorkshopPlan)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="pilot">Plan Piloto</option>
                    <option value="basic">Básico</option>
                    <option value="standard">Estándar</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">Modo de operación:</label>
                  <select
                    value={newWorkshopMode}
                    onChange={(e) => setNewWorkshopMode(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="pilot_supervised">Piloto Supervisado</option>
                    <option value="standard">Estándar Autónomo</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl text-[11px] space-y-1">
                <strong>Creación independiente de invitaciones:</strong>
                <p>
                  El taller se creará en estado de provisión inicial. Podrás revisar su configuración, canales y capacidad antes de generar la invitación de acceso de un solo uso.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {isCreating ? 'Creando...' : 'Crear Taller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
