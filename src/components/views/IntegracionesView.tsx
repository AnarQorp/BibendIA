import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  Settings, 
  CheckCircle2, 
  Database, 
  RefreshCw, 
  ArrowUpRight, 
  ShieldCheck, 
  Layers,
  FileCheck
} from 'lucide-react';

export const IntegracionesView: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Sincronización Complementaria
          </span>
          <span className="text-xs text-slate-400">· Talleres Etxeberria</span>
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Configuración & Integración ERP / DMS</h2>
        <p className="text-xs text-slate-300 max-w-3xl">
          BibendIA convive con tu programa de gestión habitual. Asume la recepción, citas y comunicación con clientes, y envía los datos preparados a tu software contable o de facturación mediante la acción <strong className="text-emerald-400">[Enviar a gestión]</strong>.
        </p>
      </div>

      {/* Primary DMS Status Card */}
      <div className="bg-[#131b2e] border border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">Software de gestión del taller</h3>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-700/60 px-2.5 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 🟢 Conectado
                </span>
              </div>
              <p className="text-xs text-slate-400">Sincronización bidireccional activa</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Última sincronización: <strong className="text-slate-200">Hace 3 min</strong></span>
            <button className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Synchronized Elements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span>Clientes & Fichas</span>
              <span className="text-emerald-400 font-mono">342 Fichas</span>
            </div>
            <p className="text-xs text-slate-400">Nombres, teléfonos y datos de contacto sincronizados.</p>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span>Vehículos & Matrículas</span>
              <span className="text-emerald-400 font-mono">418 Coches</span>
            </div>
            <p className="text-xs text-slate-400">Marcas, modelos, bastidores VIN y kilometrajes.</p>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span>Órdenes de Trabajo</span>
              <span className="text-emerald-400 font-mono">En tiempo real</span>
            </div>
            <p className="text-xs text-slate-400">Transferencia de partes de avería e intervenciones.</p>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span>Preparación Facturas</span>
              <span className="text-emerald-400 font-mono">1 Clic</span>
            </div>
            <p className="text-xs text-slate-400">Generación de borradores de factura sin volver a teclear.</p>
          </div>
        </div>
      </div>

      {/* Supported DMS Connectors Visual Grid */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-400" />
          <span>Conectores Disponibles con Soluciones de Mercado</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">SolucionTaller / GestTaller</h4>
              <p className="text-xs text-slate-400">Software DMS de gestión integral de taller</p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">Conectado</span>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">GT Estimate / Audatex</h4>
              <p className="text-xs text-slate-400">Bases de datos de tiempos y recambios OEM</p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">Conectado</span>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Holded / Factusol / ContaSimple</h4>
              <p className="text-xs text-slate-400">Facturación general y contabilidad SaaS</p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">Conectado</span>
          </div>
        </div>
      </div>
    </div>
  );
};
