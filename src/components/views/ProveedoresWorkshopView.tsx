import React from 'react';
import {
  Truck,
  AlertCircle,
  Lock,
  Clock,
  Percent,
  Settings2
} from 'lucide-react';
import type { WorkshopSupplierLink } from '../../types';

export interface ProveedoresWorkshopViewProps {
  // Configured suppliers if any (in production starts empty)
  suppliers?: WorkshopSupplierLink[];
  isLoading?: boolean;
  error?: string | null;
}

export const ProveedoresWorkshopView: React.FC<ProveedoresWorkshopViewProps> = ({
  suppliers = [],
  isLoading = false,
  error = null,
}) => {
  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">

      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Proveedores y Recambios</h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  Plan Taller
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Estructura de proveedores de recambios, condiciones operativas y fuente de precios de referencia.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl self-start sm:self-auto font-mono">
            <span>Integración: <strong>No configurada</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Error state if backend error occurs */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <div>
            <p className="font-bold">Error al consultar los proveedores del taller</p>
            <p className="text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* 3. Primary Card: BibendIA Reference Network Supplier (READ ONLY in Basic Plan - Neutral claims) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-500" /> Proveedor de Referencia BibendIA
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Solo lectura en plan básico</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 pt-1">
              Fuente de Referencia Comercial
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              En el plan básico, BibendIA utilizará el catálogo y precios de referencia del proveedor preferente asignado por la plataforma. Esta configuración es gestionada centralmente y no puede ser modificada unilateralmente por el taller.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1 sm:w-64 shrink-0 font-mono">
            <p className="font-bold text-slate-800">
              Proveedor preferente:
            </p>
            <p className="text-[11px] text-slate-500">
              Pendiente de configuración
            </p>
          </div>
        </div>

        {/* Read-only policy notice */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-slate-900">Gobernanza de Precios en Plan Básico</p>
            <p className="text-slate-600 leading-normal">
              La fuente comercial de referencia es de solo lectura. El taller no dispone de selector libre para sustituir el proveedor de referencia de la plataforma.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Workshop Linked Accounts / Local Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Linked Accounts (Empty State / Data) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-600" />
              <span>Proveedores Vinculados al Taller</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {suppliers.length} vinculados
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs">Consultando proveedores del taller...</p>
            </div>
          ) : suppliers.length === 0 ? (
            /* Honest Semantic Empty State */
            <div className="py-10 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center">
                <Truck className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-slate-800">Sin proveedores vinculados</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Actualmente no existen cuentas de recambistas vinculadas a este taller. Las vinculaciones aparecerán aquí cuando se habilite el contrato correspondiente en el backend.
                </p>
                <p className="text-[11px] text-slate-400 pt-1 font-mono">
                  Condiciones comerciales: No disponibles
                </p>
              </div>
            </div>
          ) : (
            /* Linked suppliers list */
            <div className="space-y-3">
              {suppliers.map(sup => (
                <div key={sup.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{sup.supplierName}</span>
                      {sup.isBibendiaPreferred && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                          Referencia Plataforma
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono">Ref: {sup.accountRef || 'Sin referencia'}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {sup.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Local Workshop Rules (Disabled / No fake interactivity) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-600" />
              <span>Reglas Operativas del Taller</span>
            </h3>
            <p className="text-xs text-slate-500 pt-0.5">Parámetros locales de tarificación y plazos de entrega.</p>
          </div>

          <div className="space-y-4 opacity-75">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-600 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-slate-400" /> Margen estándar sobre recambio:
                </label>
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  No configurado
                </span>
              </div>
              <input
                type="range"
                disabled
                className="w-full accent-slate-400 cursor-not-allowed opacity-50"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Plazo estimado de recepción:
                </label>
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  No configurado
                </span>
              </div>
              <input
                type="range"
                disabled
                className="w-full accent-slate-400 cursor-not-allowed opacity-50"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-normal">
              Esta configuración operativa estará disponible para su edición cuando exista el contrato backend de reglas de taller y persistencia.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
