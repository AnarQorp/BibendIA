import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Plus,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
  Clock,
  CheckCircle2,
  Building2,
  ShieldCheck,
  X,
  ExternalLink
} from 'lucide-react';
import {
  fetchPlatformInvitations,
  createPlatformInvitation,
  resendPlatformInvitation,
  expirePlatformInvitation,
  fetchPlatformTenants,
  type PlatformInvitationsState,
} from '../../../services/platformAdmin';
import type { PlatformInvitationRow, PlatformTenantSummary } from '../../../types';

export interface InvitationsAdminViewProps {
  initialTenantId?: string | null;
}

export const InvitationsAdminView: React.FC<InvitationsAdminViewProps> = ({
  initialTenantId = null,
}) => {
  const [invitationsState, setInvitationsState] = useState<PlatformInvitationsState>({ status: 'idle' });
  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  const [filterTenantId, setFilterTenantId] = useState<string>(initialTenantId || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // New Invitation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetTenantId, setTargetTenantId] = useState<string>(initialTenantId || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'OWNER' | 'MANAGER' | 'RECEPTION' | 'VIEWER'>('OWNER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Receipt Modal (Canonical: shows delivery state and audit receipt, never leaks raw secret)
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptEmail, setReceiptEmail] = useState<string | null>(null);
  const [receiptRole, setReceiptRole] = useState<string | null>(null);
  const [receiptDeliveryState, setReceiptDeliveryState] = useState<string>('disabled');
  const [receiptCorrelationId, setReceiptCorrelationId] = useState<string | null>(null);

  // Action states
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setActionError(null);
    const res = await fetchPlatformInvitations({
      tenantId: filterTenantId !== 'all' ? filterTenantId : undefined,
      status: filterStatus !== 'all' ? filterStatus : undefined,
    });
    setInvitationsState(res);
    setIsLoading(false);
  };

  useEffect(() => {
    async function loadTenantsList() {
      const res = await fetchPlatformTenants();
      if (res.status === 'success' && res.data) {
        setTenants(res.data);
        if (!targetTenantId && res.data.length > 0) {
          setTargetTenantId(res.data[0].id);
        }
      }
    }
    loadTenantsList();
  }, []);

  useEffect(() => {
    loadData();
  }, [filterTenantId, filterStatus]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!targetTenantId) {
      setFormError('Debes seleccionar un taller objetivo.');
      return;
    }
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setFormError('Introduce un correo electrónico válido.');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `invite:${targetTenantId}:${Date.now()}`;
    const res = await createPlatformInvitation(targetTenantId, {
      email: inviteEmail.trim(),
      role: inviteRole,
      idempotencyKey,
    });

    setIsSubmitting(false);
    if (!res.ok) {
      setFormError(res.message || 'Error al generar la invitación');
      return;
    }

    setIsCreateModalOpen(false);
    const receiptAfter = (res.receipt as any)?.after;
    setReceiptEmail(inviteEmail.trim());
    setReceiptRole(inviteRole);
    setReceiptDeliveryState(receiptAfter?.delivery?.state || 'disabled');
    setReceiptCorrelationId(res.correlationId || null);
    setReceiptOpen(true);
    setInviteEmail('');
    setFilterTenantId(targetTenantId);
    loadData();
  };

  const handleResend = async (inv: PlatformInvitationRow) => {
    setBusyInvitationId(inv.id);
    setActionError(null);
    const idempotencyKey = `resend:${inv.id}:${Date.now()}`;
    const res = await resendPlatformInvitation(inv.tenant_id, inv.id, {
      expectedVersion: inv.version,
      idempotencyKey,
    });
    setBusyInvitationId(null);

    if (!res.ok) {
      setActionError(res.message || 'Error al reenviar la invitación');
      return;
    }

    const receiptAfter = (res.receipt as any)?.after;
    setReceiptEmail(inv.email);
    setReceiptRole(inv.role);
    setReceiptDeliveryState(receiptAfter?.delivery?.state || 'disabled');
    setReceiptCorrelationId(res.correlationId || null);
    setReceiptOpen(true);
    loadData();
  };

  const handleExpire = async (inv: PlatformInvitationRow) => {
    if (!confirm(`¿Estás seguro de caducar la invitación para ${inv.email}? El token quedará invalidado inmediatamente.`)) {
      return;
    }
    setBusyInvitationId(inv.id);
    setActionError(null);
    const idempotencyKey = `expire:${inv.id}:${Date.now()}`;
    const res = await expirePlatformInvitation(inv.tenant_id, inv.id, {
      expectedVersion: inv.version,
      idempotencyKey,
    });
    setBusyInvitationId(null);

    if (!res.ok) {
      setActionError(res.message || 'Error al caducar la invitación');
      return;
    }

    loadData();
  };

  const invitations = invitationsState.data || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-amber-600" /> PENDIENTE
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACEPTADA
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 text-slate-400" /> CADUCADA
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <XCircle className="w-3 h-3 text-rose-600" /> CANCELADA
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Invitaciones de Acceso</h2>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              {invitations.length} invitaciones
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Gestión segura de invitaciones de un solo uso para incorporar responsables y miembros de talleres sin intervención manual de bases de datos.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Nueva Invitación</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter Chips Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Tab buttons */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(['all', 'pending', 'accepted', 'expired'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                filterStatus === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st === 'all' ? 'Todas' : st === 'pending' ? 'Pendientes' : st === 'accepted' ? 'Aceptadas' : 'Caducadas'}
            </button>
          ))}
        </div>

        {/* Tenant selector */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Filtrar por taller:</span>
          <select
            value={filterTenantId}
            onChange={(e) => setFilterTenantId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Todos los talleres</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.id.slice(0, 8)} [{t.plan || 'pilot'}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Invitations Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Correo Destinatario</th>
                <th className="py-3 px-4">Taller & Plan</th>
                <th className="py-3 px-4">Rol Asignado</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Caducidad</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No hay invitaciones registradas con los filtros actuales.</p>
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{inv.email}</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 pt-0.5">
                        id: {inv.id.slice(0, 8)}... (hash seguro)
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{inv.workshop_name || inv.tenant_name || 'Taller'}</div>
                      <div className="font-mono text-[11px] text-slate-400 uppercase">{inv.tenant_plan || 'pilot'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                        {inv.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {getStatusBadge(inv.status)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(inv.expires_at).toLocaleDateString()} {new Date(inv.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleResend(inv)}
                              disabled={busyInvitationId === inv.id}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition border border-slate-300 disabled:opacity-50"
                              title="Rota el token e invalida el anterior"
                            >
                              {busyInvitationId === inv.id ? 'Reenviando...' : 'Reenviar'}
                            </button>
                            <button
                              onClick={() => handleExpire(inv)}
                              disabled={busyInvitationId === inv.id}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg transition border border-rose-200 disabled:opacity-50"
                              title="Caducar inmediatamente esta invitación"
                            >
                              Caducar
                            </button>
                          </>
                        )}
                        {inv.status === 'expired' && (
                          <button
                            onClick={() => handleResend(inv)}
                            disabled={busyInvitationId === inv.id}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg transition border border-blue-200 disabled:opacity-50"
                          >
                            Reactivar
                          </button>
                        )}
                        {inv.status === 'accepted' && (
                          <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Consumida
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Crear Nueva Invitación */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Nueva Invitación de Acceso</h3>
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
                Emite una invitación de acceso cifrada para el responsable del taller. Se generará un enlace de un solo uso que caducará en 7 días.
              </p>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Taller destinatario:</label>
                <select
                  value={targetTenantId}
                  onChange={(e) => setTargetTenantId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || t.id} [{t.plan || 'pilot'}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Correo del responsable:</label>
                <input
                  type="email"
                  required
                  placeholder="ej: arkaitz.demo@taller-ejemplo.es"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400">
                  Para pruebas operativas, utiliza un correo ficticio demostrativo.
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Rol asignado:</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value="OWNER">Propietario / Responsable (OWNER)</option>
                  <option value="MANAGER">Jefe de Taller (MANAGER)</option>
                  <option value="RECEPTION">Recepción (RECEPTION)</option>
                  <option value="VIEWER">Visualizador (VIEWER)</option>
                </select>
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
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Generando...' : 'Generar Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Recibo Canónico de Invitación */}
      {receiptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-emerald-950 text-sm">Invitación Registrada en Plataforma</h3>
              </div>
              <button
                onClick={() => {
                  setReceiptOpen(false);
                  setReceiptEmail(null);
                  setReceiptRole(null);
                  setReceiptCorrelationId(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Se ha emitido y registrado la invitación para <strong>{receiptEmail}</strong> con rol <strong>{receiptRole}</strong>.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-mono">Estado de Entrega:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    receiptDeliveryState === 'queued'
                      ? 'bg-blue-100 text-blue-800'
                      : receiptDeliveryState === 'succeeded'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {receiptDeliveryState.toUpperCase()}
                  </span>
                </div>
                {receiptCorrelationId && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-mono">Correlación:</span>
                    <span className="font-mono text-slate-700 text-[10px]">{receiptCorrelationId}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] space-y-1">
                <strong>Gobernanza y Privacidad (Baseline 06):</strong>
                <p>
                  Por política soberana de seguridad, el token de acceso nunca se expone en la consola administrativa ni en texto plano. La invitación se entrega al destinatario verificado para su canje atómico mediante el bridge institucional OIDC.
                </p>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setReceiptOpen(false);
                  setReceiptEmail(null);
                  setReceiptRole(null);
                  setReceiptCorrelationId(null);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
              >
                Aceptar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
