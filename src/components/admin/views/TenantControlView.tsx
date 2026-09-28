import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  RotateCcw,
  Terminal,
  AlertCircle,
  Clock
} from 'lucide-react';
import {
  fetchPlatformControl,
  mutateTenantLifecycle,
  mutateTenantKillSwitch,
  type PlatformControlState
} from '../../../services/platformAdmin';

export interface TenantControlViewProps {
  tenantId: string | null;
}

function generateStableIdempotencyKey(prefix: string): string {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export const TenantControlView: React.FC<TenantControlViewProps> = ({ tenantId }) => {
  const [state, setState] = useState<PlatformControlState>({ status: 'idle' });
  const [reasonInput, setReasonInput] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<'provisioning' | 'pilot' | 'active' | 'suspended' | 'deactivated'>('pilot');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stable idempotency key that is PRESERVED across retries of the same intent
  const currentLifecycleKeyRef = useRef<string>(generateStableIdempotencyKey('lifecycle'));
  const currentKillSwitchKeyRef = useRef<string>(generateStableIdempotencyKey('ks'));

  const loadControl = async () => {
    if (!tenantId) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const res = await fetchPlatformControl(tenantId);
    setState(res);
  };

  useEffect(() => {
    if (tenantId) {
      loadControl();
    } else {
      setState({ status: 'idle' });
    }
  }, [tenantId]);

  if (!tenantId) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center">
          <Terminal className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">Selección de Tenant no disponible</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Esta vista requiere una selección de tenant autorizada por la plataforma. La lista de tenants será provista de forma segura por el catálogo de P0.9 (`GET /v1/platform/tenants`), sin inputs manuales de usuario.
        </p>
      </div>
    );
  }

  const handleLifecycleChange = async () => {
    if (!reasonInput.trim()) {
      setActionMessage({ type: 'error', text: 'Se requiere un motivo explícito para registrar la acción en la auditoría.' });
      return;
    }
    if (!state.data) return;

    setIsSubmitting(true);
    setActionMessage(null);

    // Uses stable key; preserved on failure so user retry sends the identical idempotencyKey
    const idempotencyKey = currentLifecycleKeyRef.current;

    const result = await mutateTenantLifecycle(tenantId, {
      target: selectedTarget,
      reason: reasonInput,
      expectedVersion: state.data.version,
      idempotencyKey,
    });
    setIsSubmitting(false);

    if (result.ok) {
      setActionMessage({
        type: 'success',
        text: `Ciclo de vida actualizado a '${selectedTarget}'. Correlación: ${result.correlationId}`
      });
      setReasonInput('');
      // Rotate key only after confirmed success
      currentLifecycleKeyRef.current = generateStableIdempotencyKey('lifecycle');
      loadControl();
    } else {
      setActionMessage({
        type: 'error',
        text: `${result.message || 'Error al modificar ciclo de vida'}. Reintentar conservará la clave de idempotencia (${idempotencyKey.slice(0, 16)}...).`
      });
    }
  };

  const handleToggleKillSwitch = async (enable: boolean) => {
    if (!reasonInput.trim()) {
      setActionMessage({ type: 'error', text: 'Se requiere un motivo obligatorio para el Kill Switch.' });
      return;
    }
    if (!state.data) return;

    setIsSubmitting(true);
    setActionMessage(null);

    // Uses stable key; preserved on failure so user retry sends the identical idempotencyKey
    const idempotencyKey = currentKillSwitchKeyRef.current;

    const result = await mutateTenantKillSwitch(tenantId, enable, {
      reason: reasonInput,
      expectedVersion: state.data.version,
      idempotencyKey,
    });
    setIsSubmitting(false);

    if (result.ok) {
      setActionMessage({
        type: 'success',
        text: `Kill Switch ${enable ? 'ACTIVADO (Pausado)' : 'DESACTIVADO (Reanudado)'}. Correlación: ${result.correlationId}`
      });
      setReasonInput('');
      // Rotate key only after confirmed success
      currentKillSwitchKeyRef.current = generateStableIdempotencyKey('ks');
      loadControl();
    } else {
      setActionMessage({
        type: 'error',
        text: `${result.message || 'Error al ejecutar comando'}. Reintentar conservará la clave de idempotencia (${idempotencyKey.slice(0, 16)}...).`
      });
    }
  };

  const control = state.data;

  return (
    <div className="space-y-6">

      {/* Status banner */}
      {actionMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          actionMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="opacity-70 hover:opacity-100 font-bold">×</button>
        </div>
      )}

      {/* Control State Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded">
                Tenant: {tenantId}
              </span>
              <span className="text-xs text-slate-400">Versión: {control?.version ?? '—'}</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">Panel de Control & Resiliencia Operativa</h2>
          </div>

          <button
            onClick={loadControl}
            disabled={state.status === 'loading'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg transition"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>

        {state.status === 'unauthorized' ? (
          <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-xl text-xs text-amber-300">
            {state.message} (Esperando sesión productiva de plataforma)
          </div>
        ) : state.status === 'error' ? (
          <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300">
            {state.message}
          </div>
        ) : control ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">

            {/* Lifecycle Indicator */}
            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Ciclo de Vida</span>
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                  control.lifecycle === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' :
                  control.lifecycle === 'pilot' ? 'bg-blue-950 text-blue-400 border border-blue-700' :
                  control.lifecycle === 'suspended' ? 'bg-amber-950 text-amber-400 border border-amber-700' :
                  'bg-rose-950 text-rose-400 border border-rose-700'
                }`}>
                  {control.lifecycle}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Motivo: <span className="text-slate-200">{control.lifecycleReason || 'No especificado'}</span>
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Actualizado: {control.lifecycleUpdatedAt || 'Sin cambios'}
              </p>
            </div>

            {/* Kill Switch Indicator */}
            <div className={`p-4 rounded-xl border space-y-2 ${
              control.killSwitch.enabled
                ? 'bg-rose-950/40 border-rose-700/80 text-rose-200'
                : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Kill Switch
                </span>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border">
                  {control.killSwitch.enabled ? '🔴 ACTIVADO (PAUSADO)' : '🟢 DESACTIVADO (OPERATIVO)'}
                </span>
              </div>
              <p className="text-xs opacity-90">
                {control.killSwitch.enabled
                  ? `Causa: ${control.killSwitch.reason || 'Parada de emergencia'}`
                  : 'Tráfico de voz y mutaciones de dominio permitidas.'}
              </p>
              <p className="text-[11px] opacity-75 font-mono">
                {control.killSwitch.updatedAt ? `Desde: ${control.killSwitch.updatedAt}` : 'Estado nominal'}
              </p>
            </div>

          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            Cargando estado de control...
          </div>
        )}
      </div>

      {/* Action Mutation Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-600" />
          <span>Comandos de Control de Plataforma (Auditados)</span>
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">
              Motivo de la acción (Obligatorio en auditoría):
            </label>
            <input
              type="text"
              value={reasonInput}
              onChange={e => setReasonInput(e.target.value)}
              placeholder="Indica motivo para registrar en Action Ledger..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">

            {/* Lifecycle Mutation */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-900">Transición de Ciclo de Vida</h4>
              <div className="flex gap-2">
                <select
                  value={selectedTarget}
                  onChange={e => setSelectedTarget(e.target.value as any)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium"
                >
                  <option value="provisioning">provisioning</option>
                  <option value="pilot">pilot</option>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="deactivated">deactivated (terminal)</option>
                </select>
                <button
                  type="button"
                  disabled={isSubmitting || !control}
                  onClick={handleLifecycleChange}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Enviando...' : 'Aplicar'}
                </button>
              </div>
            </div>

            {/* Kill Switch Toggle Mutation */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-900">Interruptor de Emergencia (Kill Switch)</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSubmitting || !control || control.killSwitch.enabled}
                  onClick={() => handleToggleKillSwitch(true)}
                  className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-40"
                >
                  Activar Kill Switch
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !control || !control.killSwitch.enabled}
                  onClick={() => handleToggleKillSwitch(false)}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition disabled:opacity-40"
                >
                  Desactivar
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};
