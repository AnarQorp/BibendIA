import React, { useState, useEffect } from 'react';
import {
  Calendar,
  RotateCcw,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { fetchPlatformAppointments, type PlatformAppointmentsState } from '../../../services/platformAdmin';

export interface RedactedAppointmentsViewProps {
  tenantId: string | null;
}

export const RedactedAppointmentsView: React.FC<RedactedAppointmentsViewProps> = ({ tenantId }) => {
  const [state, setState] = useState<PlatformAppointmentsState>({ status: 'idle' });

  const loadAppointments = async () => {
    if (!tenantId) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const res = await fetchPlatformAppointments(tenantId);
    setState(res);
  };

  useEffect(() => {
    if (tenantId) loadAppointments();
    else setState({ status: 'idle' });
  }, [tenantId]);

  if (!tenantId) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
          <Calendar className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">Selección de Tenant no disponible</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Para consultar citas redactadas de soporte se requiere una selección autorizada de tenant (esperando P0.9 `GET /v1/platform/tenants`).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Citas Redactadas (Soporte Plataforma)</h2>
            <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
              <EyeOff className="w-3 h-3" /> PII Redactada por Construcción
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Vista de soporte y auditoría sin datos de carácter personal (nombres, teléfonos, matrículas o síntomas cifrados).
          </p>
        </div>

        <button
          onClick={loadAppointments}
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
          <span>{state.message} (Esperando sesión de soporte de plataforma)</span>
        </div>
      ) : state.status === 'error' ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{state.message}</span>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Registros de Cita ({state.data?.length ?? 0})</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Tenant: {tenantId}
            </span>
          </div>

          {(state.data || []).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No hay citas registradas en el tenant actual.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-mono text-[11px]">
                    <th className="pb-2">Cita ID</th>
                    <th className="pb-2">Caso Ref</th>
                    <th className="pb-2">Inicio</th>
                    <th className="pb-2">Fin</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Versión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {state.data?.map(app => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="py-2.5 text-blue-700 font-semibold">{app.id.slice(0, 8)}...</td>
                      <td className="py-2.5 text-slate-600">{app.case_id ? `${app.case_id.slice(0, 8)}...` : '—'}</td>
                      <td className="py-2.5 text-slate-800">{new Date(app.start_at).toLocaleString('es-ES')}</td>
                      <td className="py-2.5 text-slate-600">{new Date(app.end_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {app.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400">v{app.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
