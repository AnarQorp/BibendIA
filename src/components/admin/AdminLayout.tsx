import React, { useState } from 'react';
import {
  ShieldAlert,
  Terminal,
  Inbox,
  Calendar,
  Truck,
  Lock,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { TenantControlView } from './views/TenantControlView';
import { OutboxMonitorView } from './views/OutboxMonitorView';
import { RedactedAppointmentsView } from './views/RedactedAppointmentsView';
import { ProveedoresAdminView } from './views/ProveedoresAdminView';

export interface AdminLayoutProps {
  onBackToWorkshop?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onBackToWorkshop }) => {
  const [activeTab, setActiveTab] = useState<'control' | 'outbox' | 'appointments' | 'proveedores'>('control');
  // Target tenant selector for administrative operations (default to known pilot tenant Jarrisons or custom)
  const [targetTenantId, setTargetTenantId] = useState<string>('tenant-jarrisons-pilot');

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">

      {/* Top Warning Banner: Non-Exposed Surface */}
      <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>ADMIN v0 (Superficie Interna Restringida):</strong> No expuesta públicamente. Requiere autorización estricta PLATFORM_USER y tokens no delegados.
          </span>
        </div>
        {onBackToWorkshop && (
          <button
            onClick={onBackToWorkshop}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-100 text-[11px] font-semibold transition"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Volver a Taller</span>
          </button>
        )}
      </div>

      {/* Admin Navbar */}
      <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base tracking-tight">BibendIA Platform Admin</span>
              <span className="text-[10px] font-mono uppercase bg-slate-800 text-blue-400 border border-slate-700 px-1.5 py-0.5 rounded">
                v0.5
              </span>
            </div>
          </div>
        </div>

        {/* Tenant Selector for Admin Operations */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Tenant ID:</span>
          <input
            type="text"
            value={targetTenantId}
            onChange={e => setTargetTenantId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-mono px-3 py-1.5 rounded-lg w-56 focus:outline-none focus:border-blue-500"
            placeholder="UUID o slug del tenant"
          />
        </div>
      </header>

      {/* Main Admin Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('control')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'proveedores'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Red de Proveedores</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="text-slate-900">
          {activeTab === 'control' && <TenantControlView tenantId={targetTenantId} />}
          {activeTab === 'outbox' && <OutboxMonitorView tenantId={targetTenantId} />}
          {activeTab === 'appointments' && <RedactedAppointmentsView tenantId={targetTenantId} />}
          {activeTab === 'proveedores' && <ProveedoresAdminView />}
        </div>

      </div>

    </div>
  );
};
