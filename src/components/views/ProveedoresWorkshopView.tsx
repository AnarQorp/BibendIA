import React, { useState } from 'react';
import {
  Truck,
  ShieldCheck,
  AlertCircle,
  Lock,
  ExternalLink,
  CheckCircle2,
  Clock,
  Percent,
  Layers,
  Settings2,
  HelpCircle
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
  const [markupRate, setMarkupRate] = useState<number>(15); // Local markup rule percentage
  const [leadTimeHours, setLeadTimeHours] = useState<number>(4);

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
                Gestión de cuentas de recambistas vinculadas, reglas de tarificación y fuente de precios de la red.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Red Homologada BibendIA</span>
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

      {/* 3. Primary Card: BibendIA Reference Network Supplier (READ ONLY in Basic Plan) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-blue-600" /> Fuente de Referencia Comercial BibendIA
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Solo lectura en plan básico</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 pt-1">
              Catálogo Oficial de la Red BibendIA
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              BibendIA valora las piezas en presupuestos automáticos tomando como base de precios y disponibilidad el mayorista preferente homologado por la red. Los talleres de la red operan con precios de referencia unificados para garantizar competitividad y rapidez de recepción.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1 sm:w-64 shrink-0">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tarificación Activa
            </p>
            <p className="text-[11px] text-slate-500">
              El motor de cotización aplica automáticamente el catálogo de referencia homologado para tu zona.
            </p>
          </div>
        </div>

        {/* Read-only notice */}
        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Política de Red y Gobernanza de Precios</p>
            <p className="text-amber-800 leading-normal">
              La asignación del distribuidor comercial preferente se gestiona a nivel de plataforma para asegurar los acuerdos de volumen de la red BibendIA. El taller no puede sustituir unilateralmente la fuente de precios base en el plan estándar.
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
              <span>Cuentas de Distribuidor Vinculadas</span>
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
                <h4 className="text-sm font-bold text-slate-800">Sin cuentas externas vinculadas</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Actualmente tu taller opera exclusivamente con el catálogo y precios base de la red BibendIA. Cuando dispongas de cuenta propia con un distribuidor homologado, se asociará aquí tras la validación de credenciales.
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
                          Preferente Red
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono">Ref: {sup.accountRef || 'Sin referencia'}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {sup.status === 'linked' ? 'Conectado' : sup.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Local Workshop Rules */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-600" />
              <span>Reglas Locales del Taller</span>
            </h3>
            <p className="text-xs text-slate-500 pt-0.5">Parámetros aplicados sobre precios y tiempos de recambio.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-blue-600" /> Margen estándar sobre coste recambio:
                </label>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  +{markupRate}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={markupRate}
                onChange={e => setMarkupRate(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Se añade automáticamente al precio de coste de piezas en borradores de presupuesto.
              </p>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" /> Plazo medio de entrega de recambios:
                </label>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {leadTimeHours} h
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                step="1"
                value={leadTimeHours}
                onChange={e => setLeadTimeHours(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Tiempo mínimo estimado antes de poder agendar reparaciones que requieran aprovisionamiento de piezas.
              </p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-xs"
              >
                Guardar Reglas Operativas
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
