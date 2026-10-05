import React, { useState, useEffect } from 'react';
import {
  Clock,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  Layers,
  Car,
  ShieldAlert
} from 'lucide-react';
import type {
  PlatformWorkshopRow,
  WorkshopCapacityData,
  WorkshopCapacityPolicy,
  WorkshopOpeningHours,
  WorkshopServiceDurationPolicy,
  WorkshopTimeSlot
} from '../../../types';
import { patchPlatformWorkshop } from '../../../services/platformAdmin';
import { getWorkshopCapacity, patchWorkshopCapacity } from '../../../services/workshopOperations';

export interface WorkshopCapacityConfigSectionProps {
  tenantId: string;
  workshop?: PlatformWorkshopRow | WorkshopCapacityData;
  workshopId?: string;
  surface?: 'workshop' | 'admin';
  onWorkshopUpdated?: () => void;
}

interface DayState {
  isOpen: boolean;
  slots: WorkshopTimeSlot[];
}

const DAYS = [
  { key: '1', name: 'Lunes' },
  { key: '2', name: 'Martes' },
  { key: '3', name: 'Miércoles' },
  { key: '4', name: 'Jueves' },
  { key: '5', name: 'Viernes' },
  { key: '6', name: 'Sábado' },
  { key: '7', name: 'Domingo' },
];

export const WorkshopCapacityConfigSection: React.FC<WorkshopCapacityConfigSectionProps> = ({
  tenantId,
  workshop: propWorkshop,
  workshopId: propWorkshopId,
  surface = 'workshop',
  onWorkshopUpdated,
}) => {
  const [internalWorkshop, setInternalWorkshop] = useState<PlatformWorkshopRow | WorkshopCapacityData | null>(propWorkshop || null);
  const effectiveWorkshopId = propWorkshop?.id || propWorkshopId || internalWorkshop?.id || '';

  // Parse opening_hours safely into day states
  const parseSchedule = (raw: unknown): Record<string, DayState> => {
    const hours = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const result: Record<string, DayState> = {};
    for (const day of DAYS) {
      const daySlots = hours[day.key];
      if (Array.isArray(daySlots) && daySlots.length > 0) {
        result[day.key] = {
          isOpen: true,
          slots: daySlots.map((s: any) => ({
            start: typeof s?.start === 'string' ? s.start : '08:30',
            end: typeof s?.end === 'string' ? s.end : '18:30',
          })),
        };
      } else {
        result[day.key] = {
          isOpen: false,
          slots: [{ start: '08:30', end: '18:30' }],
        };
      }
    }
    return result;
  };

  const [schedule, setSchedule] = useState<Record<string, DayState>>(() =>
    parseSchedule(propWorkshop?.opening_hours)
  );

  // Service Duration Policy state
  const policy = propWorkshop?.service_duration_policy;
  const [durationRules, setDurationRules] = useState({
    inspection: policy?.rules?.inspection ?? 45,
    oil_service: policy?.rules?.oil_service ?? 45,
    brakes_or_noise: policy?.rules?.brakes_or_noise ?? 45,
    generic_fault: policy?.rules?.generic_fault ?? 60,
    fallbackMinutes: policy?.fallbackMinutes ?? 60,
  });

  // Physical capacity resources state (canonical capacity_policy)
  const capPolicy = (propWorkshop as any)?.capacity_policy as WorkshopCapacityPolicy | undefined;
  const [liftCount, setLiftCount] = useState<number>(capPolicy?.liftCount ?? 2);
  const [nonLiftBayCount, setNonLiftBayCount] = useState<number>(capPolicy?.nonLiftBayCount ?? 1);
  const [concurrentTechnicians, setConcurrentTechnicians] = useState<number>(capPolicy?.concurrentTechnicians ?? 3);
  const [maxVehiclesOnSite, setMaxVehiclesOnSite] = useState<number>(capPolicy?.maxVehiclesOnSite ?? 8);
  const [maxVehicleIntakesPerHour, setMaxVehicleIntakesPerHour] = useState<number>(capPolicy?.maxVehicleIntakesPerHour ?? 2);

  // Read-only vehicles currently on site metric from backend authority
  const [vehiclesCurrentlyOnSite, setVehiclesCurrentlyOnSite] = useState<number | null>(
    typeof (propWorkshop as any)?.vehiclesCurrentlyOnSite === 'number'
      ? (propWorkshop as any).vehiclesCurrentlyOnSite
      : null
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Fetch or refresh capacity from backend if needed
  const loadCapacityFromBackend = async (targetId: string) => {
    if (!tenantId || !targetId) return;
    setIsLoading(true);
    const res = await getWorkshopCapacity(tenantId, targetId);
    setIsLoading(false);
    if (res.status === 'success' && res.data) {
      setInternalWorkshop(res.data);
      setSchedule(parseSchedule(res.data.opening_hours));
      const p = res.data.service_duration_policy;
      setDurationRules({
        inspection: p?.rules?.inspection ?? 45,
        oil_service: p?.rules?.oil_service ?? 45,
        brakes_or_noise: p?.rules?.brakes_or_noise ?? 45,
        generic_fault: p?.rules?.generic_fault ?? 60,
        fallbackMinutes: p?.fallbackMinutes ?? 60,
      });
      const c = res.data.capacity_policy;
      if (c) {
        setLiftCount(c.liftCount ?? 2);
        setNonLiftBayCount(c.nonLiftBayCount ?? 1);
        setConcurrentTechnicians(c.concurrentTechnicians ?? 3);
        setMaxVehiclesOnSite(c.maxVehiclesOnSite ?? 8);
        setMaxVehicleIntakesPerHour(c.maxVehicleIntakesPerHour ?? 2);
      }
      setVehiclesCurrentlyOnSite(typeof res.data.vehiclesCurrentlyOnSite === 'number' ? res.data.vehiclesCurrentlyOnSite : 0);
    } else if (res.status === 'unauthorized') {
      setFeedback({
        type: 'error',
        message: 'No autorizado. Solo los roles OWNER y MANAGER pueden acceder a la configuración operativa del taller.',
      });
    }
  };

  useEffect(() => {
    if (propWorkshop) {
      setInternalWorkshop(propWorkshop);
      setSchedule(parseSchedule(propWorkshop.opening_hours));
      const p = propWorkshop.service_duration_policy;
      setDurationRules({
        inspection: p?.rules?.inspection ?? 45,
        oil_service: p?.rules?.oil_service ?? 45,
        brakes_or_noise: p?.rules?.brakes_or_noise ?? 45,
        generic_fault: p?.rules?.generic_fault ?? 60,
        fallbackMinutes: p?.fallbackMinutes ?? 60,
      });
      const c = (propWorkshop as any).capacity_policy as WorkshopCapacityPolicy | undefined;
      if (c) {
        setLiftCount(c.liftCount ?? 2);
        setNonLiftBayCount(c.nonLiftBayCount ?? 1);
        setConcurrentTechnicians(c.concurrentTechnicians ?? 3);
        setMaxVehiclesOnSite(c.maxVehiclesOnSite ?? 8);
        setMaxVehicleIntakesPerHour(c.maxVehicleIntakesPerHour ?? 2);
      }
      if (typeof (propWorkshop as any).vehiclesCurrentlyOnSite === 'number') {
        setVehiclesCurrentlyOnSite((propWorkshop as any).vehiclesCurrentlyOnSite);
      }
    } else if (propWorkshopId) {
      loadCapacityFromBackend(propWorkshopId);
    }
  }, [propWorkshop, propWorkshopId]);

  // Handle Day toggle
  const toggleDayOpen = (dayKey: string) => {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        isOpen: !prev[dayKey].isOpen,
      },
    }));
  };

  // Handle slot change
  const handleSlotChange = (dayKey: string, slotIdx: number, field: 'start' | 'end', val: string) => {
    setSchedule((prev) => {
      const current = prev[dayKey];
      const newSlots = [...current.slots];
      newSlots[slotIdx] = { ...newSlots[slotIdx], [field]: val };
      return {
        ...prev,
        [dayKey]: { ...current, slots: newSlots },
      };
    });
  };

  // Add 2nd slot (split shift)
  const addSlot = (dayKey: string) => {
    setSchedule((prev) => {
      const current = prev[dayKey];
      if (current.slots.length >= 2) return prev;
      return {
        ...prev,
        [dayKey]: {
          ...current,
          slots: [
            current.slots[0] || { start: '08:30', end: '13:30' },
            { start: '15:30', end: '19:30' },
          ],
        },
      };
    });
  };

  // Remove 2nd slot
  const removeSlot = (dayKey: string, slotIdx: number) => {
    setSchedule((prev) => {
      const current = prev[dayKey];
      if (current.slots.length <= 1) return prev;
      const newSlots = current.slots.filter((_, idx) => idx !== slotIdx);
      return {
        ...prev,
        [dayKey]: { ...current, slots: newSlots },
      };
    });
  };

  // Handle Save
  const handleSave = async () => {
    const targetWorkshop = internalWorkshop || propWorkshop;
    if (!targetWorkshop && !effectiveWorkshopId) {
      setFeedback({ type: 'error', message: 'No se encontró identificador de taller válido.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    // Format opening_hours according to canonical backend schema
    const cleanOpeningHours: WorkshopOpeningHours = {};
    for (const day of DAYS) {
      const d = schedule[day.key];
      if (d.isOpen && d.slots.length > 0) {
        cleanOpeningHours[day.key] = d.slots.map((s) => ({
          start: s.start.trim() || '08:30',
          end: s.end.trim() || '18:30',
        }));
      } else {
        cleanOpeningHours[day.key] = [];
      }
    }

    const cleanDurationPolicy: WorkshopServiceDurationPolicy = {
      version: targetWorkshop?.service_duration_policy?.version || 'v1',
      rules: {
        inspection: Number(durationRules.inspection) || 45,
        oil_service: Number(durationRules.oil_service) || 45,
        brakes_or_noise: Number(durationRules.brakes_or_noise) || 45,
        generic_fault: Number(durationRules.generic_fault) || 60,
      },
      fallbackMinutes: Number(durationRules.fallbackMinutes) || 60,
    };

    const existingResourceRequirements = (targetWorkshop as any)?.capacity_policy?.resourceRequirements;

    // Fail-closed if resourceRequirements is missing on workshop surface:
    if (!existingResourceRequirements && surface === 'workshop') {
      setFeedback({
        type: 'error',
        message: 'Configuración incompleta: el taller no dispone de política inicial canónica de recursos físicos (resourceRequirements). Debe ser inicializada por backend.',
      });
      return;
    }

    const cleanCapacityPolicy: WorkshopCapacityPolicy = {
      version: (targetWorkshop as any)?.capacity_policy?.version || 'v1',
      liftCount: Math.max(1, Number(liftCount) || 1),
      nonLiftBayCount: Math.max(1, Number(nonLiftBayCount) || 1),
      concurrentTechnicians: Math.max(1, Number(concurrentTechnicians) || 1),
      maxVehiclesOnSite: Math.max(1, Number(maxVehiclesOnSite) || 1),
      maxVehicleIntakesPerHour: Math.max(1, Number(maxVehicleIntakesPerHour) || 1),
      resourceRequirements: existingResourceRequirements || null,
    };

    const expectedVersion = targetWorkshop?.version ?? 1;
    const idempotencyKey = `workshop-cfg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let saveResult: { ok: boolean; status: string; message?: string };

    if (surface === 'admin') {
      const res = await patchPlatformWorkshop(tenantId, effectiveWorkshopId, {
        expectedVersion,
        idempotencyKey,
        openingHours: cleanOpeningHours,
        serviceDurationPolicy: cleanDurationPolicy,
      });
      saveResult = { ok: res.ok, status: res.status, message: res.message };
    } else {
      const res = await patchWorkshopCapacity(tenantId, effectiveWorkshopId, {
        expectedVersion,
        idempotencyKey,
        openingHours: cleanOpeningHours,
        serviceDurationPolicy: cleanDurationPolicy,
        capacityPolicy: cleanCapacityPolicy,
      });
      saveResult = { ok: res.status === 'success', status: res.status, message: res.message };
      if (res.status === 'success' && res.data) {
        setInternalWorkshop(res.data);
      }
    }

    setIsSaving(false);

    if (saveResult.ok) {
      setFeedback({
        type: 'success',
        message: 'Configuración de capacidad y horarios guardada con éxito en backend.'
      });
      if (onWorkshopUpdated) onWorkshopUpdated();
      else loadCapacityFromBackend(effectiveWorkshopId);
      setTimeout(() => setFeedback(null), 5000);
    } else if (saveResult.status === 'unauthorized') {
      setFeedback({
        type: 'error',
        message: 'Acceso denegado: solo usuarios con rol OWNER o MANAGER pueden modificar la capacidad del taller.',
      });
    } else if (saveResult.status === 'version_conflict') {
      setFeedback({
        type: 'warning',
        message: 'Conflicto de versiones: otro usuario actualizó la configuración. Los datos más recientes se han recargado.',
      });
      if (onWorkshopUpdated) onWorkshopUpdated();
      else loadCapacityFromBackend(effectiveWorkshopId);
    } else {
      setFeedback({
        type: 'error',
        message: saveResult.message || 'Error al persistir la configuración en backend.',
      });
    }
  };

  const workshopName = (internalWorkshop as any)?.name || (propWorkshop as any)?.name || effectiveWorkshopId;
  const currentVersion = internalWorkshop?.version ?? propWorkshop?.version ?? 1;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Capacidad y Agenda</h3>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              {workshopName} (v{currentVersion})
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Configuración operativa de horarios de apertura, duración de trabajos y recursos físicos del taller.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs disabled:opacity-50 self-start sm:self-auto cursor-pointer min-h-[44px]"
        >
          {isSaving ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{isSaving ? 'Guardando...' : 'Guardar configuración'}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedback.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : feedback.type === 'warning' ? (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Aforo en vivo (Vehículos actualmente en taller) - Read-only backend authority */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">Aforo de Vehículos en Vivo</span>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
              Vehículos en taller: <span className="font-mono text-blue-700">{vehiclesCurrentlyOnSite ?? 0}</span> / <span className="font-mono text-slate-600">{maxVehiclesOnSite}</span>
            </p>
          </div>
        </div>
        <div className="text-right sm:text-right">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Métrica autoritativa en tiempo real
          </span>
        </div>
      </div>

      {/* A1. Horarios de Apertura */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Horarios de Apertura Semanales</h4>
        </div>
        <p className="text-xs text-slate-500">
          Define las franjas horarias en las que el taller acepta entradas de vehículos.
        </p>

        <div className="space-y-2">
          {DAYS.map((day) => {
            const state = schedule[day.key] || { isOpen: false, slots: [] };
            return (
              <div
                key={day.key}
                className={`p-3 rounded-xl border transition-all ${
                  state.isOpen
                    ? 'bg-slate-50/50 border-slate-200'
                    : 'bg-slate-100/40 border-slate-200/60 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 w-32 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleDayOpen(day.key)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        state.isOpen ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                      aria-label={`Alternar apertura de ${day.name}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          state.isOpen ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-xs font-bold text-slate-800">{day.name}</span>
                  </div>

                  {state.isOpen ? (
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      {state.slots.map((slot, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1.5 shadow-2xs">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) => handleSlotChange(day.key, sIdx, 'start', e.target.value)}
                            className="text-xs font-mono font-medium text-slate-800 bg-transparent focus:outline-hidden"
                          />
                          <span className="text-xs text-slate-400">a</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) => handleSlotChange(day.key, sIdx, 'end', e.target.value)}
                            className="text-xs font-mono font-medium text-slate-800 bg-transparent focus:outline-hidden"
                          />
                          {state.slots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSlot(day.key, sIdx)}
                              className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                              title="Eliminar tramo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {state.slots.length < 2 && (
                        <button
                          type="button"
                          onClick={() => addSlot(day.key)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 rounded-lg transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Turno partido</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 text-xs text-slate-400 italic">Cerrado</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* A2. Recursos Físicos del Taller (Capacidad Operativa) - Activo para OWNER/MANAGER */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Recursos Físicos del Taller</h4>
        </div>
        <p className="text-xs text-slate-500">
          Parámetros físicos y aforo aplicados por el motor de scheduling backend para validar disponibilidad en agenda.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Elevadores disponibles</label>
            <p className="text-[11px] text-slate-500 leading-tight">Puestos con elevador utilizables simultáneamente.</p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min={1}
                max={500}
                value={liftCount}
                onChange={(e) => setLiftCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">elevadores</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Otros puestos de trabajo</label>
            <p className="text-[11px] text-slate-500 leading-tight">Puestos donde puede trabajarse sin ocupar un elevador.</p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min={1}
                max={500}
                value={nonLiftBayCount}
                onChange={(e) => setNonLiftBayCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">puestos</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Técnicos simultáneos</label>
            <p className="text-[11px] text-slate-500 leading-tight">Número de mecánicos/técnicos disponibles al mismo tiempo.</p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min={1}
                max={500}
                value={concurrentTechnicians}
                onChange={(e) => setConcurrentTechnicians(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">técnicos</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Máximo de vehículos en taller</label>
            <p className="text-[11px] text-slate-500 leading-tight">Aforo máximo de vehículos que pueden permanecer en el taller.</p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min={1}
                max={500}
                value={maxVehiclesOnSite}
                onChange={(e) => setMaxVehiclesOnSite(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">vehículos</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Máximo de entradas por hora</label>
            <p className="text-[11px] text-slate-500 leading-tight">Límite de citas programables en la misma hora.</p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min={1}
                max={500}
                value={maxVehicleIntakesPerHour}
                onChange={(e) => setMaxVehicleIntakesPerHour(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">entradas/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* A3. Duración de trabajos */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Duración Estándar de Trabajos</h4>
        </div>
        <p className="text-xs text-slate-500">
          Tiempos estimados utilizados por el motor de citas para calcular la reserva de espacio en la agenda.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Revisión / inspección</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={15}
                max={480}
                step={5}
                value={durationRules.inspection}
                onChange={(e) => setDurationRules((prev) => ({ ...prev, inspection: Number(e.target.value) }))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">minutos</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Cambio de aceite / mantenimiento</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={15}
                max={480}
                step={5}
                value={durationRules.oil_service}
                onChange={(e) => setDurationRules((prev) => ({ ...prev, oil_service: Number(e.target.value) }))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">minutos</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Frenos o ruidos</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={15}
                max={480}
                step={5}
                value={durationRules.brakes_or_noise}
                onChange={(e) => setDurationRules((prev) => ({ ...prev, brakes_or_noise: Number(e.target.value) }))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">minutos</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Avería / trabajo general</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={15}
                max={480}
                step={5}
                value={durationRules.generic_fault}
                onChange={(e) => setDurationRules((prev) => ({ ...prev, generic_fault: Number(e.target.value) }))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">minutos</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-800 block">Duración por defecto</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={15}
                max={480}
                step={5}
                value={durationRules.fallbackMinutes}
                onChange={(e) => setDurationRules((prev) => ({ ...prev, fallbackMinutes: Number(e.target.value) }))}
                className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium">minutos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
