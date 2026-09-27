import React, { useState } from 'react';
import {
  Truck,
  ShieldCheck,
  Star,
  MapPin,
  Layers,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import type { PlatformSupplierSummary } from '../../../types';

export interface ProveedoresAdminViewProps {
  suppliers?: PlatformSupplierSummary[];
  isLoading?: boolean;
}

export const ProveedoresAdminView: React.FC<ProveedoresAdminViewProps> = ({
  suppliers = [],
  isLoading = false,
}) => {
  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Red de Proveedores de Recambios</h2>
            <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-200">
              Gobernanza de Red BibendIA
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Gestión de mayoristas homologados, asignación de proveedor preferente de la plataforma y cobertura territorial.
          </p>
        </div>

        <button
          type="button"
          disabled
          title="El alta de proveedores requiere el contrato backend de red (pendiente P1)"
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold rounded-xl cursor-not-allowed opacity-75 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Homologar Proveedor</span>
        </button>
      </div>

      {/* Network Preferred Supplier Policy Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Proveedor Preferente de la Red BibendIA</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Fuente de precios y disponibilidad por defecto
          </span>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Distribuidor Principal Homologado</span>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                Acuerdo de Red Activo
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Utilizado para cálculo automático de PVP de recambios, tiempos de entrega garantizados y acuerdos de atribución comercial.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shrink-0">
            <span>Cobertura: <strong className="text-slate-900">Nacional (Península)</strong></span>
            <span>·</span>
            <span>SLA Entrega: <strong className="text-slate-900">&lt; 4h</strong></span>
          </div>
        </div>
      </div>

      {/* Directory Table / Semantic Empty State */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-600" />
            <span>Directorio de Proveedores y Relaciones con Talleres ({suppliers.length})</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Estado de integraciones y catálogos
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Cargando directorio de proveedores...
          </div>
        ) : suppliers.length === 0 ? (
          /* Semantic Empty State */
          <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center">
              <Truck className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-bold text-slate-800">Directorio pendiente de integración backend</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                El endpoint de red `/v1/platform/suppliers` está reservado para la siguiente fase. Esta interfaz está preparada con el diseño 2C y no inyecta proveedores sintéticos en producción.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-mono text-[11px]">
                  <th className="pb-2">Proveedor</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2">Cobertura</th>
                  <th className="pb-2">Talleres Vinculados</th>
                  <th className="pb-2">Preferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 font-bold text-slate-900">{s.name}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-600 font-mono">{s.coverageZones.join(', ')}</td>
                    <td className="py-2.5 text-slate-800 font-mono">{s.linkedWorkshopsCount} talleres</td>
                    <td className="py-2.5">
                      {s.isNetworkPreferred ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 w-max">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Preferente
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Secundario</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
