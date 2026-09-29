import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Inbox,
  Calendar,
  Truck,
  AlertTriangle,
  Building2,
  Users,
  History,
  ChevronDown
} from 'lucide-react';
import { TenantControlView } from './views/TenantControlView';
import { OutboxMonitorView } from './views/OutboxMonitorView';
import { RedactedAppointmentsView } from './views/RedactedAppointmentsView';
import { ProveedoresAdminView } from './views/ProveedoresAdminView';
import { WorkshopsAndChannelsView } from './views/WorkshopsAndChannelsView';
import { UsersAndAccessView } from './views/UsersAndAccessView';
import { AuditActivityView } from './views/AuditActivityView';
import { fetchPlatformTenants } from '../../services/platformAdmin';
import type { PlatformTenantSummary } from '../../types';

export interface AdminLayoutProps {
  selectedTenantId?: string | null;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ selectedTenantId: initialTenantId = null }) => {
  const [activeTab, setActiveTab] = useState<'control' | 'workshops' | 'memberships' | 'appointments' | 'outbox' | 'audit' | 'proveedores'>('control');
  
  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(() => {
    if (initialTenantId) return initialTenantId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bibendia_admin_tenant_id') || null;
    }
    return null;
  });

  useEffect(() => {
    let isMounted = true;
    async function loadTenants() {
      const res = await fetchPlatformTenants();
      if (!isMounted) return;
      if (res.status === 'success' && res.data && res.data.length > 0) {
        setTenants(res.data);
        if (!selectedTenantId) {
          const first = res.data[0].id;
          setSelectedTenantId(first);
          localStorage.setItem('bibendia_admin_tenant_id', first);
        }
      }
    }
    loadTenants();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bibendia_admin_tenant_id', tenantId);
    }
  };

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

        {/* Tenant Authority Display / Selector */}
        <div className="flex w-full min-w-0 flex-col items-start gap-2 text-xs self-start sm:w-auto sm:flex-row sm:items-center sm:self-auto">
          <span className="text-slate-400 font-mono">Tenant objetivo:</span>
          {tenants.length > 0 ? (
            <div className="relative">
              <select
                value={selectedTenantId || ''}
                onChange={(e) => handleSelectTenant(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-blue-400 font-mono text-xs px-3 py-1.5 rounded-lg pr-8 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ? `${t.name} (${t.id.slice(0, 8)}...)` : t.id} [{t.lifecycle_status || 'active'}]
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          ) : selectedTenantId ? (
            <span className="bg-slate-800 border border-slate-700 text-blue-400 font-mono px-3 py-1.5 rounded-lg">
              {selectedTenantId}
            </span>
          ) : (
            <span className="max-w-full min-w-0 bg-slate-800/60 border border-slate-700/60 text-slate-500 font-mono px-3 py-1.5 rounded-lg truncate">
              Pendiente de selección autorizada (GET /v1/platform/tenants)
            </span>
          )}
        </div>
      </header>

      {/* Main Admin Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-5 sm:space-y-6">

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setActiveTab('control')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'control'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Control & Kill Switch</span>
          </button>

          <button
            onClick={() => setActiveTab('workshops')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'workshops'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Talleres & Canales</span>
          </button>

          <button
            onClick={() => setActiveTab('memberships')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'memberships'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Usuarios & Accesos</span>
          </button>

          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'appointments'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Citas Redactadas</span>
          </button>

          <button
            onClick={() => setActiveTab('outbox')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'outbox'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Monitor Outbox</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Auditoría & Traza</span>
          </button>

          <button
            onClick={() => setActiveTab('proveedores')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
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
          {activeTab === 'workshops' && <WorkshopsAndChannelsView tenantId={selectedTenantId} />}
          {activeTab === 'memberships' && <UsersAndAccessView tenantId={selectedTenantId} />}
          {activeTab === 'appointments' && <RedactedAppointmentsView tenantId={selectedTenantId} />}
          {activeTab === 'outbox' && <OutboxMonitorView tenantId={selectedTenantId} />}
          {activeTab === 'audit' && <AuditActivityView tenantId={selectedTenantId} />}
          {activeTab === 'proveedores' && <ProveedoresAdminView />}
        </div>

      </div>

    </div>
  );
};
