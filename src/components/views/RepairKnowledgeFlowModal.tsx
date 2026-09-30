import React, { useState, useEffect, useRef } from 'react';
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
  Info,
  Layers,
  Check,
  FileText
} from 'lucide-react';
import type {
  Vehicle,
  Customer,
  RepairKnowledgeResolution,
  EstimateAutomationStatus,
  VehicleKind,
  VehicleCatalogMake,
  VehicleCatalogModel,
  RepairKnowledgeJob,
  RepairKnowledgeEngineOption
} from '../../types';
import { fetchVehicleCatalogFacets } from '../../services/vehicleCatalog';
import {
  fetchRepairKnowledgeVehicleFacets,
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
  onContinueManual?: (context: { plate?: string; vin?: string; make?: string; model?: string }) => void;
  initialVehicleId?: string;
  initialJobCode?: string;
  initialPlate?: string;
}

export const RepairKnowledgeFlowModal: React.FC<RepairKnowledgeFlowModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  vehicles,
  customers,
  onDraftCreated,
  onInspectEvidence,
  onContinueManual,
  initialVehicleId,
  initialJobCode,
  initialPlate
}) => {
  if (!isOpen) return null;

  // Step state: 'select' | 'preview' | 'creating'
  const [step, setStep] = useState<'select' | 'preview' | 'creating'>('select');

  // Contextual initial vehicle from Agenda if available
  const initialVehicle = initialVehicleId
    ? vehicles.find(v => v.id === initialVehicleId)
    : (initialPlate ? vehicles.find(v => v.plate.toUpperCase() === initialPlate.toUpperCase()) : undefined);

  // 1. Vehicle Identification (Optional Inputs)
  const [plate, setPlate] = useState<string>(initialPlate || initialVehicle?.plate || '');
  const [vin, setVin] = useState<string>(initialVehicle?.vin || '');
  const [kind, setKind] = useState<VehicleKind>('car');

  // 2. Vehicle Catalog State
  const [makes, setMakes] = useState<VehicleCatalogMake[]>([]);
  const [isLoadingMakes, setIsLoadingMakes] = useState<boolean>(false);
  const [selectedMake, setSelectedMake] = useState<string>('');

  const [models, setModels] = useState<VehicleCatalogModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // 3. Repair Knowledge State
  const [availableJobs, setAvailableJobs] = useState<RepairKnowledgeJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [selectedJobCode, setSelectedJobCode] = useState<string>(initialJobCode || '');

  // 4. Disambiguation State (Only requested if RK returns DISAMBIGUATION_REQUIRED)
  const [isDisambiguating, setIsDisambiguating] = useState<boolean>(false);
  const [disambiguationOptions, setDisambiguationOptions] = useState<RepairKnowledgeEngineOption[]>([]);
  const [selectedDisambiguationKey, setSelectedDisambiguationKey] = useState<string>('');

  // 5. Resolution & Draft State
  const [resolution, setResolution] = useState<RepairKnowledgeResolution | null>(null);
  const [isLoadingResolution, setIsLoadingResolution] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cancellation controller ref to avoid race conditions when switching inputs quickly
  const abortControllerRef = useRef<AbortController | null>(null);

  // The active selected model metadata
  const selectedModel = models.find(m => m.sourceModelId === selectedModelId);
  const isRkCovered = Boolean(selectedModel?.repairKnowledgeAvailable);

  // ---------------------------------------------------------------------------
  // Load Makes on Mount or when Kind changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingMakes(true);
    setMakes([]);
    setSelectedMake('');
    setModels([]);
    setSelectedModelId('');
    setAvailableJobs([]);
    setSelectedJobCode('');
    setIsDisambiguating(false);
    setDisambiguationOptions([]);
    setSelectedDisambiguationKey('');
    setResolution(null);
    setErrorMessage(null);

    fetchVehicleCatalogFacets(tenantId, { kind }, controller.signal)
      .then((res) => {
        if (res.status === 'success' && res.data) {
          setMakes(res.data.makes);
          // If contextual vehicle from Agenda matches a brand, preselect it
          if (initialVehicle?.brand) {
            const foundMake = res.data.makes.find(
              m => m.name.toLowerCase() === initialVehicle.brand.toLowerCase() ||
                   m.sourceMakeId.toLowerCase() === initialVehicle.brand.toLowerCase()
            );
            if (foundMake) {
              setSelectedMake(foundMake.sourceMakeId);
            }
          }
        } else if (res.status === 'unauthorized') {
          setErrorMessage('Sesión no autorizada para consultar el catálogo de vehículos.');
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setErrorMessage('Error al consultar el catálogo de marcas.');
        }
      })
      .finally(() => {
        setIsLoadingMakes(false);
      });

    return () => {
      controller.abort();
    };
  }, [tenantId, kind]);

  // ---------------------------------------------------------------------------
  // Load Models when Make changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedMake) {
      setModels([]);
      setSelectedModelId('');
      setAvailableJobs([]);
      setSelectedJobCode('');
      setIsDisambiguating(false);
      setDisambiguationOptions([]);
      setSelectedDisambiguationKey('');
      setResolution(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingModels(true);
    setModels([]);
    setSelectedModelId('');
    setAvailableJobs([]);
    setSelectedJobCode('');
    setIsDisambiguating(false);
    setDisambiguationOptions([]);
    setSelectedDisambiguationKey('');
    setResolution(null);
    setErrorMessage(null);

    fetchVehicleCatalogFacets(tenantId, { kind, make: selectedMake }, controller.signal)
      .then((res) => {
        if (res.status === 'success' && res.data) {
          setModels(res.data.models);
          // If contextual vehicle matches a model, preselect it
          if (initialVehicle?.model) {
            const firstWord = initialVehicle.model.split(' ')[0].toLowerCase();
            const foundModel = res.data.models.find(
              m => m.name.toLowerCase() === firstWord ||
                   m.sourceModelId.toLowerCase() === firstWord
            );
            if (foundModel) {
              setSelectedModelId(foundModel.sourceModelId);
            }
          }
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setErrorMessage('Error al consultar los modelos del fabricante.');
        }
      })
      .finally(() => {
        setIsLoadingModels(false);
      });

    return () => {
      controller.abort();
    };
  }, [tenantId, kind, selectedMake]);

  // ---------------------------------------------------------------------------
  // Load Repair Knowledge Jobs when Model changes (Only if RK available)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedModelId || !selectedModel || !selectedModel.repairKnowledgeAvailable) {
      setAvailableJobs([]);
      setSelectedJobCode('');
      setIsDisambiguating(false);
      setDisambiguationOptions([]);
      setSelectedDisambiguationKey('');
      setResolution(null);
      return;
    }

    const target = selectedModel.repairKnowledgeTargets[0];
    if (!target) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingJobs(true);
    setAvailableJobs([]);
    setSelectedJobCode(initialJobCode || '');
    setIsDisambiguating(false);
    setDisambiguationOptions([]);
    setSelectedDisambiguationKey('');
    setResolution(null);
    setErrorMessage(null);

    fetchRepairKnowledgeVehicleFacets(tenantId, { make: target.make, model: target.model }, controller.signal)
      .then((res) => {
        if (res.status === 'success' && res.data) {
          setAvailableJobs(res.data.repairJobs);
          // If an initial job is specified or there is an active job, select it
          if (initialJobCode && res.data.repairJobs.some(j => j.code === initialJobCode)) {
            setSelectedJobCode(initialJobCode);
          } else if (res.data.repairJobs.length === 1) {
            setSelectedJobCode(res.data.repairJobs[0].code);
          }
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setErrorMessage('Error al consultar los trabajos técnicos disponibles.');
        }
      })
      .finally(() => {
        setIsLoadingJobs(false);
      });

    return () => {
      controller.abort();
    };
  }, [tenantId, selectedModelId, selectedModel]);

  // ---------------------------------------------------------------------------
  // Step 1: Query Knowledge (Attempts resolution WITHOUT engine upfront)
  // ---------------------------------------------------------------------------
  const handleQueryKnowledge = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedModel || !selectedJobCode) return;

    const target = selectedModel.repairKnowledgeTargets[0];
    if (!target) return;

    setIsLoadingResolution(true);
    setErrorMessage(null);

    // Progressive check: pass engineCode ONLY if already disambiguated
    let queryEngineCode: string | undefined = undefined;
    let queryVariant: string | undefined = undefined;

    if (isDisambiguating && selectedDisambiguationKey) {
      const chosen = disambiguationOptions.find(
        opt => `${opt.engineCode}_${opt.variant || ''}` === selectedDisambiguationKey
      );
      if (chosen) {
        queryEngineCode = chosen.engineCode;
        queryVariant = chosen.variant ?? undefined;
      }
    }

    const res = await resolveRepairKnowledge(tenantId, {
      make: target.make,
      model: target.model,
      repairJobCode: selectedJobCode,
      engineCode: queryEngineCode,
      variant: queryVariant
    });

    setIsLoadingResolution(false);

    if (res.status === 'success' && res.data) {
      setResolution(res.data);
      setIsDisambiguating(false);
      setStep('preview');
    } else if (res.status === 'disambiguation_required' && res.disambiguation) {
      // Reveal progressive disambiguation selector only now
      setIsDisambiguating(true);
      setDisambiguationOptions(res.disambiguation.options);
      if (res.disambiguation.options.length > 0) {
        const first = res.disambiguation.options[0];
        setSelectedDisambiguationKey(`${first.engineCode}_${first.variant || ''}`);
      }
    } else {
      setErrorMessage(res.message || 'No se encontró propuesta técnica para los datos especificados.');
    }
  };

  // ---------------------------------------------------------------------------
  // Step 2 -> Step 3: Confirm and Create Persistent Draft
  // ---------------------------------------------------------------------------
  const handleConfirmCreateDraft = async () => {
    if (!selectedModel || !resolution) return;

    setStep('creating');
    setErrorMessage(null);

    const idempotencyKey = `rk-draft-${tenantId.slice(0, 4)}-${Date.now()}`;
    const selectedVeh = initialVehicle || vehicles[0];
    const selectedCust = customers[0];

    const target = selectedModel.repairKnowledgeTargets[0];

    const command = {
      vehicleId: selectedVeh?.id || 'v5',
      idempotencyKey,
      vehicle: {
        make: target.make,
        model: target.model,
        engineCode: resolution.applicability.engineCode
      },
      repairJobCode: selectedJobCode
    };

    const res = await createEstimateDraft(tenantId, command);

    if (res.status === 'success' && res.data) {
      const newQuote = convertEstimateDraftToQuote(
        res.data,
        selectedCust?.name || 'Cliente Taller',
        plate || selectedVeh?.plate || '7731 CKB'
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
              <h3 className="text-base font-extrabold text-slate-900">Nuevo Presupuesto Técnico</h3>
              <p className="text-xs text-slate-500">
                Selección de vehículo y operaciones contrastadas para elaborar la propuesta del taller.
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
            <span>Vehículo y Operación</span>
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
          {/* STEP 1: SELECT VEHICLE AND REPAIR JOB PROGRESSIVELY                         */}
          {/* ========================================================================= */}
          {step === 'select' && (
            <form onSubmit={handleQueryKnowledge} className="space-y-6">
              
              {/* Layer 1: Vehicle Identification (Optional Inputs) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-blue-600" />
                    <span>Identificación del Vehículo</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Datos opcionales para la orden</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Matrícula <span className="font-normal text-slate-400">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={plate}
                      onChange={(e) => setPlate(e.target.value.toUpperCase())}
                      placeholder="ej. 7731 CKB"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      VIN / Bastidor <span className="font-normal text-slate-400">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      placeholder="ej. WVWZZZ1KZ9W..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Layer 2: Progressive Vehicle Catalog Selection */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-600" />
                    <span>Catálogo de Vehículos</span>
                  </h4>

                  {/* Kind Selector: Turismo / Furgoneta */}
                  <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setKind('car')}
                      className={`px-3 py-1 rounded-md transition ${
                        kind === 'car'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Turismo
                    </button>
                    <button
                      type="button"
                      onClick={() => setKind('van')}
                      className={`px-3 py-1 rounded-md transition ${
                        kind === 'van'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Furgoneta
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Marca */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Marca
                    </label>
                    <select
                      value={selectedMake}
                      onChange={(e) => setSelectedMake(e.target.value)}
                      disabled={isLoadingMakes}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="">{isLoadingMakes ? 'Cargando marcas...' : 'Seleccionar marca...'}</option>
                      {makes.map((m) => (
                        <option key={m.sourceMakeId} value={m.sourceMakeId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Modelo */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Modelo
                    </label>
                    <select
                      value={selectedModelId}
                      onChange={(e) => setSelectedModelId(e.target.value)}
                      disabled={!selectedMake || isLoadingModels}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedMake
                          ? 'Primero elige una marca...'
                          : isLoadingModels
                          ? 'Cargando modelos...'
                          : models.length === 0
                          ? 'Sin modelos disponibles'
                          : 'Seleccionar modelo...'}
                      </option>
                      {models.map((mo) => (
                        <option key={mo.sourceModelId} value={mo.sourceModelId}>
                          {mo.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notice for Models WITHOUT Repair Knowledge (e.g. Peugeot 308) */}
                {selectedModelId && selectedModel && !isRkCovered && (
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-blue-950">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Conocimiento técnico todavía no disponible para esta versión.</span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed pl-6">
                      El vehículo ha quedado seleccionado en el catálogo. Las intervenciones asistidas por conocimiento técnico verificado aún no están disponibles para este modelo; puedes preparar un presupuesto manual o consultar otro vehículo.
                    </p>
                  </div>
                )}
              </div>

              {/* Layer 3: Repair Operation & Progressive Disambiguation */}
              {isRkCovered && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-slate-600" />
                    <span>Intervención del Taller</span>
                  </h4>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Tipo de trabajo u operación
                    </label>
                    <select
                      value={selectedJobCode}
                      onChange={(e) => {
                        setSelectedJobCode(e.target.value);
                        setIsDisambiguating(false);
                        setDisambiguationOptions([]);
                        setSelectedDisambiguationKey('');
                        setResolution(null);
                      }}
                      disabled={isLoadingJobs}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="">{isLoadingJobs ? 'Cargando trabajos...' : 'Seleccionar trabajo...'}</option>
                      {availableJobs.map((job) => (
                        <option key={job.code} value={job.code}>
                          {job.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Progressive Disambiguation Panel: Rendered ONLY if requested by RK */}
                  {isDisambiguating && disambiguationOptions.length > 0 && (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2.5 animate-fadeIn">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Se requiere concretar la motorización o versión:</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        La intervención varía según la variante mecánica. Selecciona la correspondiente:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {disambiguationOptions.map((opt) => {
                          const key = `${opt.engineCode}_${opt.variant || ''}`;
                          const isSelected = selectedDisambiguationKey === key;

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedDisambiguationKey(key)}
                              className={`p-2.5 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition ${
                                isSelected
                                  ? 'bg-white border-blue-600 text-blue-900 shadow-2xs ring-1 ring-blue-600'
                                  : 'bg-white/80 border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancelar
                </button>

                {!isRkCovered && selectedModelId && selectedModel && (
                  <button
                    type="button"
                    onClick={() => {
                      const makeName = makes.find(m => m.sourceMakeId === selectedMake)?.name || selectedMake;
                      const modelName = selectedModel?.name || '';
                      if (onContinueManual) {
                        onContinueManual({
                          plate: plate.trim() || initialVehicle?.plate,
                          vin: vin.trim() || initialVehicle?.vin,
                          make: makeName,
                          model: modelName
                        });
                      }
                      onClose();
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-xs transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Continuar con presupuesto manual →</span>
                  </button>
                )}

                {isRkCovered && (
                  <button
                    type="submit"
                    disabled={!selectedJobCode || isLoadingResolution || (isDisambiguating && !selectedDisambiguationKey)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                  >
                    {isLoadingResolution ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Consultando propuesta...</span>
                      </>
                    ) : isDisambiguating ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirmar motorización y ver propuesta →</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Consultar propuesta técnica →</span>
                      </>
                    )}
                  </button>
                )}
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
                    {makes.find(m => m.sourceMakeId === selectedMake)?.name || selectedMake} {selectedModel?.name}
                    {plate ? ` · ${plate}` : ''}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white pt-1">
                  {resolution.repairJob.name}
                </h4>
                {resolution.repairJob.description && (
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {resolution.repairJob.description}
                  </p>
                )}
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
                                evidence: edge.evidence,
                                applicabilityCode: resolution.applicability.code,
                                knowledgeRevision: (resolution as any)?.knowledgeRevision
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  ← Modificar selección
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
                  Preparando las líneas y partidas para que puedas asignar precios y mano de obra en el taller.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
