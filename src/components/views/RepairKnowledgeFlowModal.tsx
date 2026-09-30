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
  RefreshCw,
  FileCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import type {
  Vehicle,
  Customer,
  RepairKnowledgeResolution,
  EstimateAutomationStatus
} from '../../types';
import {
  resolveRepairKnowledge,
  createEstimateDraft,
  convertEstimateDraftToQuote,
  getAutomationStatusFromEdge
} from '../../services/repairKnowledge';
import {
  formatAutomationStatus,
  formatPartName
} from '../../utils/workshopFormatters';

export interface RepairKnowledgeFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  vehicles: Vehicle[];
  customers: Customer[];
  onDraftCreated: (newQuote: any) => void;
  onInspectEvidence: (item: any) => void;
  initialVehicleId?: string;
  initialJobCode?: string;
}

export const RepairKnowledgeFlowModal: React.FC<RepairKnowledgeFlowModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  vehicles,
  customers,
  onDraftCreated,
  onInspectEvidence,
  initialVehicleId,
  initialJobCode
}) => {
  if (!isOpen) return null;

  // Step state: 'select' | 'preview' | 'creating'
  const [step, setStep] = useState<'select' | 'preview' | 'creating'>('select');

  // Selection inputs
  const defaultVehicle = initialVehicleId
    ? vehicles.find(v => v.id === initialVehicleId)
    : vehicles.find(v => v.brand.toLowerCase().includes('volkswagen') || v.model.toLowerCase().includes('golf')) || vehicles[0];

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(defaultVehicle?.id || 'v5');
  const [make, setMake] = useState<string>(defaultVehicle?.brand || 'Volkswagen');
  const [model, setModel] = useState<string>(defaultVehicle?.model ? defaultVehicle.model.split(' ')[0] : 'Golf VII');
  const [engineCode, setEngineCode] = useState<string>(
    defaultVehicle?.motorization && defaultVehicle.motorization.includes('CLHA')
      ? 'CLHA'
      : (defaultVehicle?.motorization?.split(' ')[0] || 'CLHA')
  );
  const [repairJobCode, setRepairJobCode] = useState<string>(initialJobCode || 'JOB_TIMING_BELT_WATER_PUMP');

  // Resolution state from GET /repair-knowledge/resolve
  const [resolution, setResolution] = useState<RepairKnowledgeResolution | null>(null);
  const [isLoadingResolution, setIsLoadingResolution] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        setEngineCode(found.motorization.split(' ')[0] || 'CLHA');
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
      setStep('preview');
    } else {
      setErrorMessage(res.message || 'No se encontró propuesta técnica para los datos especificados.');
    }
  };

  // Step 2 -> Step 3: Confirm and create persistent draft
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
      setErrorMessage(res.message || 'Error al guardar el borrador del presupuesto.');
    }
  };

  const renderStatusBadge = (status: EstimateAutomationStatus) => {
    const p = formatAutomationStatus(status);
    let icon = <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
    if (status === 'OPTIONAL') icon = <HelpCircle className="w-3 h-3 text-blue-600" />;
    if (status === 'REVIEW_REQUIRED') icon = <AlertTriangle className="w-3 h-3 text-amber-600" />;
    if (status === 'BLOCKED') icon = <Ban className="w-3 h-3 text-slate-500" />;

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border flex items-center gap-1 ${p.badgeClass}`}>
        {icon}
        {p.label}
      </span>
    );
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
              <h3 className="text-base font-extrabold text-slate-900">Nuevo Presupuesto con Conocimiento Técnico</h3>
              <p className="text-xs text-slate-500">
                Consulta especificaciones y genera el borrador técnico con las piezas y operaciones recomendadas.
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
            <span>Vehículo y Trabajo</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <div className={`flex items-center gap-2 font-bold ${step === 'preview' ? 'text-blue-600' : 'text-slate-500'}`}>
            <span className="w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center text-[11px] font-mono">2</span>
            <span>Propuesta de Partidas</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <div className={`flex items-center gap-2 font-bold ${step === 'creating' ? 'text-blue-600' : 'text-slate-500'}`}>
            <span className="w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center text-[11px] font-mono">3</span>
            <span>Guardando Borrador</span>
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
              
              {/* Quick Vehicle Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-blue-600" />
                  <span>Seleccionar Vehículo</span>
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
              </div>

              {/* Vehicle & Engine Descriptors */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-slate-600" />
                  <span>Datos del Vehículo y Motor</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Marca</label>
                    <input
                      type="text"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Modelo</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Código de motor</label>
                    <input
                      type="text"
                      value={engineCode}
                      onChange={(e) => setEngineCode(e.target.value.toUpperCase())}
                      required
                      placeholder="ej. CLHA"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Tipo de intervención</label>
                  <select
                    value={repairJobCode}
                    onChange={(e) => setRepairJobCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    <option value="JOB_TIMING_BELT_WATER_PUMP">
                      Sustitución de kit de distribución y bomba de refrigerante
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
                      <span>Consultando propuesta...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Consultar propuesta técnica →</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: PREVIEW PROPOSAL                                                  */}
          {/* ========================================================================= */}
          {step === 'preview' && resolution && (
            <div className="space-y-6">
              
              {/* Applicability Card */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-800">
                    Propuesta técnica disponible
                  </span>
                  <span className="text-xs text-slate-300">
                    {make} {model} ({engineCode})
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white pt-1">
                  {resolution.repairJob.name}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {resolution.repairJob.description}
                </p>
              </div>

              {/* Status explanation legend */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="font-bold text-slate-700">Criterio de inclusión:</span>
                <span className="flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Incluido (preceptivo)
                </span>
                <span className="flex items-center gap-1 font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  <HelpCircle className="w-3 h-3 text-blue-600" /> Opcional
                </span>
                <span className="flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Revisar
                </span>
                <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                  <Ban className="w-3 h-3 text-slate-500" /> No incluido automáticamente
                </span>
              </div>

              {/* Components List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Partidas técnicas y consumibles ({resolution.components.length + resolution.consumables.length})
                  </h4>
                  <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded font-bold">
                    Precios a valorar en borrador
                  </span>
                </div>

                <div className="space-y-2">
                  {[...resolution.components, ...resolution.consumables].map((edge) => {
                    const autoStatus = getAutomationStatusFromEdge(edge);
                    const displayName = formatPartName({
                      partRoleCode: edge.partRole.code,
                      partRoleName: edge.partRole.name,
                      edgeCode: edge.code
                    });

                    return (
                      <div
                        key={edge.code}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(autoStatus)}
                            <span className="text-xs font-bold text-slate-900">{displayName}</span>
                            <span className="text-[11px] text-slate-500">
                              (Cant: {edge.quantity ?? '—'})
                            </span>
                          </div>

                          {edge.replaceOnce && (
                            <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[10px] font-bold inline-block">
                              Sustitución preceptiva (1 solo uso)
                            </span>
                          )}

                          {edge.condition && (
                            <p className="text-[11px] text-amber-700 italic">
                              Condición: {edge.condition}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded text-xs font-semibold">
                            Precio pendiente
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              onInspectEvidence({
                                title: displayName,
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
                            <span>Por qué se recomienda</span>
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
                  ← Modificar Datos
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCreateDraft}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <FileCheck className="w-4 h-4 text-emerald-300" />
                  <span>Crear Borrador de Presupuesto →</span>
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
                  Guardando borrador de presupuesto...
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto pt-1">
                  Preparando las líneas y tiempos de intervención para que puedas asignar precios y mano de obra.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
