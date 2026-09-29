import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Ban,
  Car,
  Wrench,
  ArrowRight,
  RefreshCw,
  FileCheck,
  ChevronRight,
  ShieldCheck,
  Info
} from 'lucide-react';
import type {
  Vehicle,
  Customer,
  EstimateDraft,
  RepairKnowledgeResolution,
  RepairKnowledgeEdge,
  EstimateAutomationStatus,
  RepairEvidence
} from '../../types';
import {
  resolveRepairKnowledge,
  createEstimateDraft,
  convertEstimateDraftToQuote,
  getAutomationStatusFromEdge
} from '../../services/repairKnowledge';

export interface RepairKnowledgeFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  vehicles: Vehicle[];
  customers: Customer[];
  onDraftCreated: (newQuote: any) => void;
  onInspectEvidence: (item: any) => void;
}

export const RepairKnowledgeFlowModal: React.FC<RepairKnowledgeFlowModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  vehicles,
  customers,
  onDraftCreated,
  onInspectEvidence
}) => {
  if (!isOpen) return null;

  // Step state: 'select' | 'preview' | 'creating'
  const [step, setStep] = useState<'select' | 'preview' | 'creating'>('select');

  // Selection inputs (Default to Volkswagen Golf VII CLHA for immediate testing)
  const defaultGolf = vehicles.find(v => v.brand.toLowerCase().includes('volkswagen') || v.model.toLowerCase().includes('golf'));
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(defaultGolf?.id || vehicles[0]?.id || 'v5');
  const [make, setMake] = useState<string>('Volkswagen');
  const [model, setModel] = useState<string>('Golf VII');
  const [engineCode, setEngineCode] = useState<string>('CLHA');
  const [repairJobCode, setRepairJobCode] = useState<string>('JOB_TIMING_BELT_WATER_PUMP');

  // Resolution state from GET /repair-knowledge/resolve
  const [resolution, setResolution] = useState<RepairKnowledgeResolution | null>(null);
  const [isLoadingResolution, setIsLoadingResolution] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  // Sync inputs when vehicle dropdown changes
  const handleVehicleSelect = (vId: string) => {
    setSelectedVehicleId(vId);
    const found = vehicles.find(v => v.id === vId);
    if (found) {
      setMake(found.brand);
      setModel(found.model.split(' ')[0]);
      if (found.motorization && found.motorization.includes('CLHA')) {
        setEngineCode('CLHA');
      } else if (found.motorization) {
        setEngineCode(found.motorization.split(' ')[0] || 'GENERIC');
      }
    }
  };

  // Step 1 -> Step 2: Query Repair Knowledge
  const handleQueryKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingResolution(true);
    setErrorMessage(null);

    const res = await resolveRepairKnowledge(tenantId, {
      make,
      model,
      engineCode,
      repairJobCode
    });

    setIsLoadingResolution(false);

    if (res.status === 'success' && res.data) {
      setResolution(res.data);
      setCorrelationId(res.correlationId || null);
      setStep('preview');
    } else {
      setErrorMessage(res.message || 'No se encontró conocimiento técnico aplicable para los parámetros especificados.');
    }
  };

  // Step 2 -> Step 3: Confirm and create persistent draft (POST /estimate-drafts)
  const handleConfirmCreateDraft = async () => {
    setStep('creating');
    setErrorMessage(null);

    const idempotencyKey = `rk-draft-${tenantId.slice(0, 4)}-${Date.now()}`;
    const selectedVeh = vehicles.find(v => v.id === selectedVehicleId);
    const selectedCust = customers.find(c => c.id === 'c5') || customers[0];

    const command = {
      vehicleId: selectedVehicleId || 'v5',
      idempotencyKey,
      vehicle: {
        make,
        model,
        engineCode
      },
      repairJobCode
    };

    const res = await createEstimateDraft(tenantId, command);

    if (res.status === 'success' && res.data) {
      const newQuote = convertEstimateDraftToQuote(
        res.data,
        selectedCust?.name || 'Cliente Taller',
        selectedVeh?.plate || '7731 CKB'
      );
      onDraftCreated(newQuote);
      onClose();
    } else {
      setStep('preview');
      setErrorMessage(res.message || 'Error al persistir el borrador técnico en el backend.');
    }
  };

  const getLiteralStatusBadge = (status: EstimateAutomationStatus) => {
    switch (status) {
      case 'AUTO_INCLUDED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            AUTO_INCLUDED
          </span>
        );
      case 'OPTIONAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-300">
            OPTIONAL
          </span>
        );
      case 'REVIEW_REQUIRED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
            REVIEW_REQUIRED
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
            BLOCKED
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Nuevo Presupuesto Técnico (Repair Knowledge)</h3>
                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  RK03 Slice
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Flujo: Vehículo/Reparación → Consultar Conocimiento → Propuesta Técnica → Crear Borrador Idempotente
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

        {/* Progress Stepper Bar */}
        <div className="border-b border-slate-200 bg-slate-100/70 px-6 py-2.5 flex items-center justify-between text-xs">
          <div className={`flex items-center gap-2 font-bold ${step === 'select' ? 'text-blue-600' : 'text-slate-500'}`}>
            <span className="w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center text-[11px] font-mono">1</span>
            <span>Vehículo & Reparación</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <div className={`flex items-center gap-2 font-bold ${step === 'preview' ? 'text-blue-600' : 'text-slate-500'}`}>
            <span className="w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center text-[11px] font-mono">2</span>
            <span>Propuesta Técnica Resuelta</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <div className={`flex items-center gap-2 font-bold ${step === 'creating' ? 'text-blue-600' : 'text-slate-500'}`}>
            <span className="w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center text-[11px] font-mono">3</span>
            <span>Borrador Idempotente</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: SELECT VEHICLE AND REPAIR JOB                                      */}
          {/* ========================================================================= */}
          {step === 'select' && (
            <form onSubmit={handleQueryKnowledge} className="space-y-6">
              
              {/* Quick Vehicle Picker from Workshop */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-blue-600" />
                  <span>Seleccionar Vehículo del Taller</span>
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => handleVehicleSelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} — {v.brand} {v.model} ({v.motorization || 'Motor N/D'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Tip: Selecciona el <strong className="text-slate-800">Volkswagen Golf VII (CLHA)</strong> para probar el vertical slice canónico de RK01/RK03.
                </p>
              </div>

              {/* Technical Descriptors Grid */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-slate-600" />
                  <span>Descriptores Técnicos (GET /repair-knowledge/resolve)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Marca (Make)</label>
                    <input
                      type="text"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Modelo (Model)</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Código Motor (EngineCode)</label>
                    <input
                      type="text"
                      value={engineCode}
                      onChange={(e) => setEngineCode(e.target.value.toUpperCase())}
                      required
                      placeholder="ej. CLHA"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Código de Operación Técnica (RepairJobCode)</label>
                  <select
                    value={repairJobCode}
                    onChange={(e) => setRepairJobCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  >
                    <option value="JOB_TIMING_BELT_WATER_PUMP">
                      JOB_TIMING_BELT_WATER_PUMP — Sustitución kit distribución + bomba refrigerante
                    </option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoadingResolution}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                >
                  {isLoadingResolution ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Consultando Backend...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Consultar Repair Knowledge →</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: PREVIEW TECHNICAL PROPOSAL RESIDUAL CONTRACT                       */}
          {/* ========================================================================= */}
          {step === 'preview' && resolution && (
            <div className="space-y-6">
              
              {/* Applicability Banner */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      GET /repair-knowledge/resolve: 200 OK
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {resolution.applicability.code}
                    </span>
                  </div>
                  {correlationId && (
                    <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                      Corr: {correlationId.slice(0, 14)}...
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-white pt-1">
                  {resolution.repairJob.name}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {resolution.repairJob.description}
                </p>
              </div>

              {/* Status explanation pills */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px]">
                <span className="font-bold text-slate-700">Estados backend literales:</span>
                <span className="flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  AUTO_INCLUDED (Inclusión preceptiva)
                </span>
                <span className="flex items-center gap-1 font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  REVIEW_REQUIRED (Condicional / Desgaste)
                </span>
                <span className="flex items-center gap-1 font-mono font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  OPTIONAL (Recomendado)
                </span>
                <span className="flex items-center gap-1 font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                  BLOCKED (Bloqueado)
                </span>
              </div>

              {/* Components List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Componentes Técnicos y Consumibles ({resolution.components.length + resolution.consumables.length})
                  </h4>
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold">
                    Precios pendientes de asignación en taller
                  </span>
                </div>

                <div className="space-y-2">
                  {[...resolution.components, ...resolution.consumables].map((edge) => {
                    const autoStatus = getAutomationStatusFromEdge(edge);
                    return (
                      <div
                        key={edge.code}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getLiteralStatusBadge(autoStatus)}
                            <span className="text-xs font-bold text-slate-900">{edge.partRole.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              (Cant: {edge.quantity ?? '—'})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span>Tipo: <strong className="text-slate-700">{edge.requirementType}</strong></span>
                            <span>· Confianza: <strong className="text-slate-700 font-mono">{edge.confidenceState}</strong></span>
                            {edge.replaceOnce && (
                              <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                1 solo uso (Tornillo angular)
                              </span>
                            )}
                          </div>

                          {edge.condition && (
                            <p className="text-[11px] text-amber-700 italic">
                              Condición: {edge.condition}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded text-xs font-mono font-bold">
                            Precio pendiente
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              onInspectEvidence({
                                title: edge.partRole.name,
                                itemType: edge.itemKind,
                                repairBomEdgeId: edge.code,
                                confidenceState: edge.confidenceState,
                                automationStatus: autoStatus,
                                reviewRequired: edge.manualReviewRequired,
                                confidenceReason: edge.confidenceReason,
                                condition: edge.condition,
                                notes: edge.notes,
                                evidence: edge.evidence
                              })
                            }
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                          >
                            <Info className="w-3.5 h-3.5" />
                            <span>Por qué aparece</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  ← Modificar Consulta
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCreateDraft}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <FileCheck className="w-4 h-4 text-emerald-300" />
                  <span>Confirmar y Crear Borrador Técnico (POST) →</span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: CREATING DRAFT SPINNER                                             */}
          {/* ========================================================================= */}
          {step === 'creating' && (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto" />
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-slate-900">
                  Creando Borrador Técnico Idempotente...
                </h4>
                <p className="text-xs text-slate-500 font-mono">
                  POST /v1/workshop/tenants/{tenantId.slice(0, 8)}.../estimate-drafts
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto pt-2">
                  El servidor registra la aplicabilidad, el número de revisión del conocimiento técnico y las líneas con precios explícitamente pendientes.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
