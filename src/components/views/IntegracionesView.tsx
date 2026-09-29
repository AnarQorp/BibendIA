import React, { useState } from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  Settings, 
  CheckCircle2, 
  Database, 
  RefreshCw, 
  ArrowUpRight, 
  ShieldCheck, 
  Layers, 
  FileCheck, 
  Check 
} from 'lucide-react';

export const IntegracionesView: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState('Hace 3 min');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setFeedback('Sincronizando con ERP / DMS del taller...');
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncText('Hace un momento');
      setFeedback('Sincronización completada correctamente con DMS local.');
      setTimeout(() => setFeedback(null), 4000);
    }, 1200);
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sincronización Complementaria
          </span>
          <span className="text-xs text-slate-500">· Taller Conectado</span>
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Configuración & Integración ERP / DMS</h2>
        <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
          BibendIA convive con tu programa de gestión habitual. Asume la recepción, citas y comunicación con clientes, y envía los datos preparados a tu software contable o de facturación mediante la acción <strong className="text-slate-900 font-bold">[Enviar a gestión]</strong>.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-fadeIn">
          <RefreshCw className={`w-4 h-4 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Primary DMS Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Software de gestión del taller</h3>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 🟢 Conectado
                </span>
              </div>
              <p className="text-xs text-slate-500">Sincronización bidireccional activa</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500 font-mono">Última sincronización: <strong className="text-slate-900 font-bold">{lastSyncText}</strong></span>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="Forzar comprobación de sincronización"
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-all shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Synchronized Elements Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span>Clientes & Fichas</span>
              <span className="text-emerald-700 font-mono">342 Fichas</span>
            </div>
            <p className="text-xs text-slate-500">Nombres, teléfonos y datos de contacto sincronizados.</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span>Vehículos & Matrículas</span>
              <span className="text-emerald-700 font-mono">418 Coches</span>
            </div>
            <p className="text-xs text-slate-500">Marcas, modelos, bastidores VIN y kilometrajes.</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span>Órdenes de Trabajo</span>
              <span className="text-emerald-700 font-mono">En tiempo real</span>
            </div>
            <p className="text-xs text-slate-500">Transferencia de partes de avería e intervenciones.</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
              <span>Preparación Facturas</span>
              <span className="text-emerald-700 font-mono">1 Clic</span>
            </div>
            <p className="text-xs text-slate-500">Generación de borradores de factura sin volver a teclear.</p>
          </div>
        </div>
      </div>

      {/* Supported DMS Connectors Visual Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Conectores Disponibles con Soluciones de Mercado</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">SolucionTaller / GestTaller</h4>
              <p className="text-xs text-slate-500">Software DMS de gestión integral de taller</p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">Conectado</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">GT Estimate / Audatex</h4>
              <p className="text-xs text-slate-500">Bases de datos de tiempos y recambios OEM</p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">Conectado</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Holded / Factusol / ContaSimple</h4>
              <p className="text-xs text-slate-500">Facturación general y contabilidad SaaS</p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">Conectado</span>
          </div>
        </div>
      </div>
    </div>
  );
};
