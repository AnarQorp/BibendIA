import React, { useState, useEffect } from 'react';
import {
  Clock,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  Lock,
  Layers
} from 'lucide-react';
import type {
  PlatformWorkshopRow,
  WorkshopOpeningHours,
  WorkshopServiceDurationPolicy,
  WorkshopTimeSlot
} from '../../../types';
import { patchPlatformWorkshop } from '../../../services/platformAdmin';

export interface WorkshopCapacityConfigSectionProps {
  tenantId: string;
  workshop: PlatformWorkshopRow;
  onWorkshopUpdated: () => void;
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
  workshop,
  onWorkshopUpdated,
}) => {
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

  const [schedule, setSchedule] = useState<Record<string, DayState>>(() => parseSchedule(workshop.opening_hours));

  // Service Duration Policy state
  const policy = workshop.service_duration_policy;
  const [durationRules, setDurationRules] = useState({
    inspection: policy?.rules?.inspection ?? 45,
    oil_service: policy?.rules?.oil_service ?? 45,
    brakes_or_noise: policy?.rules?.brakes_or_noise ?? 45,
    generic_fault: policy?.rules?.generic_fault ?? 60,
    fallbackMinutes: policy?.fallbackMinutes ?? 60,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Sync state when workshop prop changes (e.g. reload after conflict)
  useEffect(() => {
    setSchedule(parseSchedule(workshop.opening_hours));
    const p = workshop.service_duration_policy;
    setDurationRules({
      inspection: p?.rules?.inspection ?? 45,
      oil_service: p?.rules?.oil_service ?? 45,
      brakes_or_noise: p?.rules?.brakes_or_noise ?? 45,
      generic_fault: p?.rules?.generic_fault ?? 60,
      fallbackMinutes: p?.fallbackMinutes ?? 60,
    });
    setFeedback(null);
  }, [workshop.id, workshop.version]);

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
      version: workshop.service_duration_policy?.version || 'v1',
      rules: {
        inspection: Number(durationRules.inspection) || 45,
        oil_service: Number(durationRules.oil_service) || 45,
        brakes_or_noise: Number(durationRules.brakes_or_noise) || 45,
        generic_fault: Number(durationRules.generic_fault) || 60,
      },
      fallbackMinutes: Number(durationRules.fallbackMinutes) || 60,
    };

    const idempotencyKey = `workshop-cfg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const res = await patchPlatformWorkshop(tenantId, workshop.id, {
      expectedVersion: workshop.version,
      idempotencyKey,
      openingHours: cleanOpeningHours,
      serviceDurationPolicy: cleanDurationPolicy,
    });

    setIsSaving(false);

    if (res.status === 'success' && res.receipt) {
      setFeedback({
        type: 'success',
        message: 'Configuración de taller guardada y confirmada en backend (recibo registrado).'
      });
      // Refrescar workshop vía GET de autoridad backend
      onWorkshopUpdated();
      setTimeout(() => setFeedback(null), 5000);
    } else if (res.status === 'version_conflict') {
      setFeedback({
        type: 'warning',
        message: 'Conflicto de versiones: otro usuario actualizó el taller. Los datos más recientes se han cargado.',
      });
      onWorkshopUpdated();
    } else {
      setFeedback({
        type: 'error',
        message: res.message || 'Error al persistir la configuración en backend.',
      });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Capacidad y Agenda</h3>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              {workshop.name || workshop.id} (v{workshop.version})
            </span>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Configuración operativa de horarios de apertura, duración de trabajos y parámetros de capacidad.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs disabled:opacity-50 self-start sm:self-auto"
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
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* A1. Horario */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Horario de Taller</h4>
        </div>
        <p className="text-xs text-slate-500">
          Define las franjas de disponibilidad operativa para cada día de la semana. Se admiten hasta 2 tramos por día (jornada partida).
        </p>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
          {DAYS.map((day) => {
            const current = schedule[day.key] || { isOpen: false, slots: [] };
            return (
              <div key={day.key} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-40 shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={current.isOpen}
                      onChange={() => toggleDayOpen(day.key)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <span className={`text-xs font-bold ${current.isOpen ? 'text-slate-900' : 'text-slate-400'}`}>
                    {day.name}
                  </span>
                  {!current.isOpen && (
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">
                      Cerrado
                    </span>
                  )}
                </div>

                {current.isOpen ? (
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    {current.slots.map((slot, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {sIdx === 0 ? 'Tramo 1' : 'Tramo 2'}:
                        </span>
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) => handleSlotChange(day.key, sIdx, 'start', e.target.value)}
                          className="text-xs font-mono font-semibold text-slate-800 bg-transparent border-none p-0 focus:ring-0"
                        />
                        <span className="text-xs text-slate-400">–</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) => handleSlotChange(day.key, sIdx, 'end', e.target.value)}
                          className="text-xs font-mono font-semibold text-slate-800 bg-transparent border-none p-0 focus:ring-0"
                        />
                        {sIdx === 1 && (
                          <button
                            type="button"
                            onClick={() => removeSlot(day.key, sIdx)}
                            className="p-1 text-slate-400 hover:text-red-600 transition"
                            title="Eliminar segundo tramo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}

                    {current.slots.length < 2 && (
                      <button
                        type="button"
                        onClick={() => addSlot(day.key)}
                        className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Añadir 2º tramo</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No hay actividad planificada para este día</div>
                )}
              </div>
            );
          })}
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

      {/* A2. Recursos del taller (Capacidad física) - Solo en entorno de desarrollo hasta integración canónica de naQor */}
      {Boolean((import.meta as any).env?.DEV) && (
        <div className="space-y-3 pt-3 border-t border-slate-100 opacity-80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Recursos Físicos del Taller (Entorno de Desarrollo)</h4>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
              <Lock className="w-3 h-3 text-slate-500" />
              Próximamente
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Límites físicos y de puestos de trabajo del taller. En preparación para próxima versión operativa.
          </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-600 block">Elevadores disponibles</label>
            <p className="text-[11px] text-slate-400 leading-tight">Puestos con elevador que pueden utilizarse simultáneamente.</p>
            <input
              type="number"
              disabled
              value={2}
              className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 border border-slate-300 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-600 block">Otros puestos de trabajo</label>
            <p className="text-[11px] text-slate-400 leading-tight">Puestos donde puede trabajarse sin ocupar un elevador.</p>
            <input
              type="number"
              disabled
              value={1}
              className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 border border-slate-300 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-600 block">Técnicos trabajando simultáneamente</label>
            <p className="text-[11px] text-slate-400 leading-tight">Número habitual de mecánicos/técnicos disponibles al mismo tiempo.</p>
            <input
              type="number"
              disabled
              value={2}
              className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 border border-slate-300 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-600 block">Máximo de vehículos en el taller</label>
            <p className="text-[11px] text-slate-400 leading-tight">Cuántos vehículos pueden permanecer simultáneamente en las instalaciones.</p>
            <input
              type="number"
              disabled
              value={6}
              className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 border border-slate-300 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-slate-600 block">Máximo de entradas por hora</label>
            <p className="text-[11px] text-slate-400 leading-tight">Evita concentrar demasiadas entregas de vehículos en la misma franja.</p>
            <input
              type="number"
              disabled
              value={2}
              className="w-20 px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 border border-slate-300 rounded-lg text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
