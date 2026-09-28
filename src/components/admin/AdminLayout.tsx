import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Inbox,
  Calendar,
  Truck,
  AlertTriangle,
  Lock,
  RotateCcw,
  Building2
} from 'lucide-react';
import { TenantControlView } from './views/TenantControlView';
import { OutboxMonitorView } from './views/OutboxMonitorView';
import { RedactedAppointmentsView } from './views/RedactedAppointmentsView';
import { ProveedoresAdminView } from './views/ProveedoresAdminView';
import {
  fetchPlatformTenants,
  type PlatformTenantsState,
  type PlatformTenantItem
} from '../../services/platformAdmin';

export interface AdminLayoutProps {
  selectedTenantId?: string | null;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ selectedTenantId: propSelectedTenantId = null }) => {
  const [activeTab, setActiveTab] = useState<'control' | 'outbox' | 'appointments' | 'proveedores'>('control');
  const [tenantsState, setTenantsState] = useState<PlatformTenantsState>({ status: 'idle' });
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(propSelectedTenantId);

  const loadTenants = useCallback(async () => {
    setTenantsState({ status: 'loading' });
    const res = await fetchPlatformTenants();
    setTenantsState(res);
    if (res.status === 'success' && res.data && res.data.length > 0) {
      setSelectedTenantId(current => {
        if (current && res.data?.some(t => t.id === current)) return current;
        return res.data![0].id;
      });
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    if (propSelectedTenantId) {
      setSelectedTenantId(propSelectedTenantId);
    }
  }, [propSelectedTenantId]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">

      {/* Top Warning Banner: Non-Exposed Surface */}
      <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>ADMIN v0 (Superficie Interna Restringida):</strong> Destinada a `admin.bibendia.com`. No expuesta públicamente. Requiere autorización estricta PLATFORM_USER y tokens no delegados.
          </span>
        </div>
      </div>

      {/* Admin Navbar */}
      <header className="border-b border-slate-800 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-h-16 py-3 sm:py-0 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base tracking-tight">BibendIA Platform Admin</span>
              <span className="text-[10px] font-mono uppercase bg-slate-800 text-blue-400 border border-slate-700 px-1.5 py-0.5 rounded">
                Superficie Interna
              </span>
            </div>
          </div>
        </div>

        {/* Real P0.9 Authorized Tenant Selector */}
        <div className="flex w-full min-w-0 flex-col items-start gap-2 text-xs self-start sm:w-auto sm:flex-row sm:items-center sm:self-auto">
          <span className="text-slate-400 font-mono flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Tenant objetivo:</span>
          </span>

          {tenantsState.status === 'loading' ? (
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-400 font-mono">
              <RotateCcw className="w-3 h-3 animate-spin text-blue-400" />
              <span>Consultando P0.9...</span>
            </div>
          ) : tenantsState.status === 'unauthorized' ? (
            <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-800/80 text-amber-300 font-mono px-3 py-1.5 rounded-lg" title={tenantsState.message}>
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Sesión plataforma requerida</span>
            </div>
          ) : tenantsState.status === 'error' ? (
            <div className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-800 text-rose-300 font-mono px-3 py-1.5 rounded-lg">
              <span>{tenantsState.message}</span>
              <button onClick={loadTenants} className="text-slate-400 hover:text-white ml-1">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          ) : tenantsState.status === 'success' && tenantsState.data && tenantsState.data.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedTenantId ?? ''}
                onChange={e => setSelectedTenantId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-blue-400 font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
              >
                {tenantsState.data.map((t: PlatformTenantItem) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.operating_mode === 'pilot_supervised' ? 'Piloto' : 'Estándar'} · {t.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
              <button
                onClick={loadTenants}
                title="Actualizar catálogo de tenants"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/60 text-slate-400 font-mono px-3 py-1.5 rounded-lg">
              <span>Sin tenants disponibles</span>
              <button onClick={loadTenants} className="text-slate-400 hover:text-white ml-1">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Admin Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-5 sm:space-y-6">

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setActiveTab('control')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'control'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Control & Kill Switch</span>
          </button>

          <button
            onClick={() => setActiveTab('outbox')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'outbox'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Monitor Outbox</span>
          </button>

          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'appointments'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Citas Redactadas</span>
          </button>

          <button
            onClick={() => setActiveTab('proveedores')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'proveedores'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Proveedores</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="text-slate-900">
          {activeTab === 'control' && <TenantControlView tenantId={selectedTenantId} />}
          {activeTab === 'outbox' && <OutboxMonitorView tenantId={selectedTenantId} />}
          {activeTab === 'appointments' && <RedactedAppointmentsView tenantId={selectedTenantId} />}
          {activeTab === 'proveedores' && <ProveedoresAdminView />}
        </div>

      </div>

    </div>
  );
};
