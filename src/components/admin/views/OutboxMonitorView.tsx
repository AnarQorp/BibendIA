import React, { useState, useEffect } from 'react';
import {
  Inbox,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { fetchPlatformOutbox, type PlatformOutboxState } from '../../../services/platformAdmin';

export interface OutboxMonitorViewProps {
  tenantId: string | null;
}

export const OutboxMonitorView: React.FC<OutboxMonitorViewProps> = ({ tenantId }) => {
  const [state, setState] = useState<PlatformOutboxState>({ status: 'idle' });

  const loadOutbox = async () => {
    if (!tenantId) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const res = await fetchPlatformOutbox(tenantId);
    setState(res);
  };

  useEffect(() => {
    if (tenantId) loadOutbox();
    else setState({ status: 'idle' });
  }, [tenantId]);

  if (!tenantId) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
          <Inbox className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">Selección de Tenant no disponible</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Para inspeccionar el Outbox y eventos en reconciliación se requiere una selección autorizada de tenant (esperando P0.9 `GET /v1/platform/tenants`).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Monitor de Fiabilidad Outbox</h2>
            <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              P0.7 Leased Worker State
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Eventos asíncronos garantizados, reconciliación y trazabilidad de entrega a downstream.
          </p>
        </div>

        <button
          onClick={loadOutbox}
          disabled={state.status === 'loading'}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition self-start sm:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {state.status === 'unauthorized' ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span>{state.message} (Esperando sesión de plataforma)</span>
        </div>
      ) : state.status === 'error' ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{state.message}</span>
        </div>
      ) : (
        <>
          {/* Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(state.summary || []).length === 0 ? (
              <div className="col-span-full p-6 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-500">
                Sin eventos registrados en el outbox para este tenant.
              </div>
            ) : (
              state.summary?.map(item => (
                <div key={item.delivery_state} className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
                  <span className="text-[11px] font-mono uppercase text-slate-500 font-bold block truncate">
                    {item.delivery_state}
                  </span>
                  <p className="text-xl font-extrabold text-slate-900 font-mono">
                    {item.count}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Max intentos: {item.max_attempts}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Attention Items Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Elementos Requeridos de Atención ({state.attention?.length ?? 0})</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                failed_safe_to_retry, unknown_outcome, dead_letter
              </span>
            </div>

            {(state.attention || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-700 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="font-bold">Todo en orden</p>
                <p className="text-emerald-600 text-[11px]">No hay incidencias de outbox pendientes de reconciliación.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-mono text-[11px]">
                      <th className="pb-2">Evento / Tipo</th>
                      <th className="pb-2">Estado</th>
                      <th className="pb-2">Intentos</th>
                      <th className="pb-2">Error Seguro</th>
                      <th className="pb-2">Reconciliación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.attention?.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-mono text-slate-800">
                          {item.event_type}
                          <span className="block text-[10px] text-slate-400 font-mono">{item.id.slice(0, 8)}...</span>
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            item.delivery_state === 'dead_letter' ? 'bg-rose-100 text-rose-800' :
                            item.delivery_state === 'unknown_outcome' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {item.delivery_state}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-slate-600">
                          {item.attempts}/{item.max_attempts}
                        </td>
                        <td className="py-2.5 font-mono text-slate-500 text-[11px]">
                          {item.last_error_code || '—'}
                        </td>
                        <td className="py-2.5">
                          {item.reconciliation_required ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Requerida
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Automático</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
};
