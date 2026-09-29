import React from 'react';
import {
  ShieldCheck,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Ban
} from 'lucide-react';
import type { RepairEvidence, EstimateAutomationStatus } from '../../types';

export interface RepairEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    title: string;
    itemType?: string;
    repairBomEdgeId?: string;
    confidenceState?: string;
    automationStatus?: EstimateAutomationStatus;
    reviewRequired?: boolean;
    confidenceReason?: string;
    condition?: string | null;
    notes?: string | null;
    evidence?: RepairEvidence[];
  } | null;
}

export const RepairEvidenceModal: React.FC<RepairEvidenceModalProps> = ({
  isOpen,
  onClose,
  item
}) => {
  if (!isOpen || !item) return null;

  const getStatusBadge = (status?: EstimateAutomationStatus) => {
    switch (status) {
      case 'AUTO_INCLUDED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> AUTO_INCLUDED
          </span>
        );
      case 'OPTIONAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" /> OPTIONAL
          </span>
        );
      case 'REVIEW_REQUIRED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> REVIEW_REQUIRED
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <Ban className="w-3.5 h-3.5 text-rose-600" /> BLOCKED
          </span>
        );
      default:
        return null;
    }
  };

  const evidenceList = item.evidence || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">Evidencia y Provenance Técnica (RK03)</h3>
                {getStatusBadge(item.automationStatus)}
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Por qué aparece esta pieza / trabajo en la propuesta de reparación
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          
          {/* Component Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">{item.title}</span>
              {item.confidenceState && (
                <span className="text-[11px] font-mono font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                  {item.confidenceState}
                </span>
              )}
            </div>

            {item.repairBomEdgeId && (
              <p className="text-[11px] text-slate-500 font-mono">
                BOM Edge ID: <strong className="text-slate-800">{item.repairBomEdgeId}</strong>
              </p>
            )}

            {item.confidenceReason && (
              <p className="text-[11px] text-slate-600">
                Criterio de Inclusión: <strong className="text-slate-900 font-mono">{item.confidenceReason}</strong>
              </p>
            )}

            {item.condition && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Condición de inspección técnica:</span>
                  <p className="mt-0.5">{item.condition}</p>
                </div>
              </div>
            )}

            {item.notes && (
              <p className="text-[11px] text-slate-500 italic">
                Observaciones: {item.notes}
              </p>
            )}
          </div>

          {/* Evidence Sources List */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Fuentes de Evidencia Verificadas ({evidenceList.length})</span>
            </h4>

            {evidenceList.length === 0 ? (
              <p className="text-slate-400 italic py-3 text-center">
                No hay referencias documentales adjuntas para este elemento.
              </p>
            ) : (
              <div className="space-y-2.5">
                {evidenceList.map((ev, idx) => (
                  <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs">{ev.source}</span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                          {ev.sourceType}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(ev.checkedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[320px]">
                        Ref: {ev.reference}
                      </span>
                      <span className="font-bold text-slate-600 text-[10px]">
                        Estado: {ev.reuseStatus}
                      </span>
                    </div>

                    {ev.notes && (
                      <p className="text-[11px] text-slate-600 italic pt-1">
                        "{ev.notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono">
            Contrato RK03 · Inmutable en servidor
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
