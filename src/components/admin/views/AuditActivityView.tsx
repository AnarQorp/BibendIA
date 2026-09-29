import React, { useState, useEffect } from 'react';
import { History, Activity, RefreshCw, AlertCircle, Terminal, FileCode } from 'lucide-react';
import {
  fetchPlatformAudit,
  type PlatformAuditState
} from '../../../services/platformAdmin';

export interface AuditActivityViewProps {
  tenantId: string | null;
}

export const AuditActivityView: React.FC<AuditActivityViewProps> = ({ tenantId }) => {
  const [state, setState] = useState<PlatformAuditState>({ status: 'idle' });
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    if (!tenantId) {
      setState({ status: 'idle' });
      return;
    }
    setIsLoading(true);
    const res = await fetchPlatformAudit(tenantId);
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
          Selecciona un tenant en la barra superior para inspeccionar el registro inmutable de auditoría y la traza de actividad.
        </p>
      </div>
    );
  }

  const auditEvents = state.auditEvents || [];
  const activityEvents = state.activityEvents || [];

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Auditoría y Traza de Operaciones</h2>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              {tenantId}
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Registro de eventos criptográficos de auditoría (cambios de estado, kill switch, mutaciones) y actividad telemática.
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
        
        {/* Audit Log Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Eventos de Auditoría ({auditEvents.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">GET /audit</span>
          </div>

          {state.status === 'loading' || isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">Cargando auditoría...</div>
          ) : state.status === 'error' ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{state.message}</span>
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">No hay registros de auditoría registrados para este tenant.</div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {auditEvents.map((a) => (
                <div key={a.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded">
                      {a.event_type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(a.occurred_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Actor: {a.actor_id || a.actor_type || 'system'}</span>
                    <span>Destino: {a.entity_type}:{a.entity_id}</span>
                  </div>
                  {a.correlation_id && (
                    <div className="text-[10px] font-mono text-slate-400">
                      Correlación: {a.correlation_id}
                    </div>
                  )}
                  {a.evidence_ref && (
                    <div className="p-1.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600 truncate">
                      Evidencia: {a.evidence_ref}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Log Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Actividad del Sistema ({activityEvents.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">GET /activity</span>
          </div>

          {state.status === 'loading' || isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">Cargando actividad...</div>
          ) : activityEvents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">No hay actividad reciente registrada.</div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {activityEvents.map((act) => (
                <div key={act.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 font-mono">{act.event_type}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(act.occurred_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-mono">
                    Actor: {act.actor_id || act.actor_type || 'anon'} · {act.entity_type}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
