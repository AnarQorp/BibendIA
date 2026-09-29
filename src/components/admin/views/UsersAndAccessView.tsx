import React, { useState, useEffect } from 'react';
import { Users, KeyRound, RefreshCw, AlertCircle, Terminal, Shield, CheckCircle2 } from 'lucide-react';
import {
  fetchPlatformMembershipsAndGrants,
  type PlatformMembershipsState
} from '../../../services/platformAdmin';

export interface UsersAndAccessViewProps {
  tenantId: string | null;
}

export const UsersAndAccessView: React.FC<UsersAndAccessViewProps> = ({ tenantId }) => {
  const [state, setState] = useState<PlatformMembershipsState>({ status: 'idle' });
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    if (!tenantId) {
      setState({ status: 'idle' });
      return;
    }
    setIsLoading(true);
    const res = await fetchPlatformMembershipsAndGrants(tenantId);
    setState(res);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  if (!tenantId) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
          <Terminal className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-white">Pendiente de Selección Autorizada</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Selecciona un tenant en la barra superior para auditar usuarios adscritos y autorizaciones de acceso.
        </p>
      </div>
    );
  }

  const memberships = state.memberships || [];
  const grants = state.grants || [];

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Usuarios, Roles y Permisos</h2>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              {tenantId}
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Miembros del taller con roles operativos asignados y concesiones de privilegios (Human Auth & RBAC).
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-300 self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Memberships Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Membresías del Taller ({memberships.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">GET /memberships</span>
          </div>

          {state.status === 'loading' || isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">Cargando usuarios...</div>
          ) : state.status === 'error' ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{state.message}</span>
            </div>
          ) : memberships.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">No hay membresías registradas para este tenant.</div>
          ) : (
            <div className="space-y-2">
              {memberships.map((m) => (
                <div key={`${m.user_id}-${m.role}`} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{m.user_id}</span>
                      <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase">
                        {m.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Registrado: {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'N/D'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform Grants Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Concesiones de Plataforma ({grants.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">GET /grants</span>
          </div>

          {state.status === 'loading' || isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">Cargando autorizaciones...</div>
          ) : grants.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">No hay grants o permisos especiales asignados a este tenant.</div>
          ) : (
            <div className="space-y-2">
              {grants.map((g) => (
                <div key={g.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-purple-600" />
                      <span className="text-xs font-bold text-slate-900 font-mono">{g.role}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-mono">
                        {g.scope_type}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      Usuario: {g.user_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {g.valid_until ? `Expira: ${new Date(g.valid_until).toLocaleDateString()}` : 'Sin expiración'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
