import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Ban,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import type { RepairEvidence, EstimateAutomationStatus } from '../../types';
import { formatAutomationStatus, formatPartName } from '../../utils/workshopFormatters';

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
    knowledgeRevision?: string | null;
    version?: number | null;
    applicabilityCode?: string | null;
  } | null;
}

export const RepairEvidenceModal: React.FC<RepairEvidenceModalProps> = ({
  isOpen,
  onClose,
  item
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen || !item) return null;

  const statusPresentation = formatAutomationStatus(item.automationStatus);
  const displayName = formatPartName({
    description: item.title,
    edgeCode: item.repairBomEdgeId
  });

  const getStatusIcon = (status?: EstimateAutomationStatus) => {
    switch (status) {
      case 'AUTO_INCLUDED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'OPTIONAL':
        return <HelpCircle className="w-3.5 h-3.5 text-blue-600" />;
      case 'REVIEW_REQUIRED':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
      case 'BLOCKED':
        return <Ban className="w-3.5 h-3.5 text-slate-500" />;
      default:
        return <Info className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const evidenceList = item.evidence || [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">Por qué se recomienda</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${statusPresentation.badgeClass}`}>
                  {getStatusIcon(item.automationStatus)} {statusPresentation.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Conocimiento técnico contrastado para esta reparación
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
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          
          {/* Layer 1: Workshop Comprehensible Summary */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">{displayName}</span>
              <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                {statusPresentation.label}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {statusPresentation.description}.
            </p>

            {item.condition && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Comprobación en taller:</span>
                  <p className="mt-0.5">{item.condition}</p>
                </div>
              </div>
            )}

            {item.notes && (
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 space-y-0.5">
                <span className="font-bold text-slate-800 text-[11px] block">Nota técnica:</span>
                <p className="text-[11px] leading-relaxed">{item.notes}</p>
              </div>
            )}
          </div>

          {/* Layer 2: Advanced Technical Details & Sources (Collapsible) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition"
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Fuentes técnicas contrastadas {evidenceList.length > 0 ? `(${evidenceList.length})` : ''}
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                {item.repairBomEdgeId && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    Ref. técnica: <strong className="text-slate-800">{item.repairBomEdgeId}</strong>
                  </p>
                )}

                {item.confidenceReason && (
                  <p className="text-[11px] text-slate-600">
                    Criterio técnico: <strong className="text-slate-900 font-mono">{item.confidenceReason}</strong>
                  </p>
                )}

                {(item.applicabilityCode || item.knowledgeRevision || (item.version !== undefined && item.version !== null)) && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-[11px]">
                    <span className="font-bold text-slate-900 block">Detalles de trazabilidad</span>
                    {item.applicabilityCode && (
                      <p className="text-[10px] text-slate-600 font-mono break-all">
                        Aplicabilidad: <span className="text-slate-800">{item.applicabilityCode}</span>
                      </p>
                    )}
                    {item.knowledgeRevision && (
                      <p className="text-[10px] text-slate-600 font-mono break-all">
                        Revisión: <span className="text-slate-800">{item.knowledgeRevision}</span>
                      </p>
                    )}
                    {item.version !== undefined && item.version !== null && (
                      <p className="text-[10px] text-slate-600 font-mono">
                        Versión: <span className="text-slate-800">v{item.version}</span>
                      </p>
                    )}
                  </div>
                )}

                {evidenceList.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px] py-1">
                    No hay referencias documentales adicionales asociadas.
                  </p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {evidenceList.map((ev, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{ev.source}</span>
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                            {ev.sourceType}
                          </span>
                        </div>
                        {ev.reference && (
                          <div className="text-[10px] font-mono text-slate-600 truncate">
                            Ref: {ev.reference}
                          </div>
                        )}
                        {ev.notes && (
                          <p className="text-[10px] text-slate-500 italic">
                            "{ev.notes}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Fuentes técnicas contrastadas
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
