import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, Clock, User, Car, AlertCircle, Wrench } from 'lucide-react';
import type { WorkshopCustomer, WorkshopVehicle, WorkshopAppointmentResponse, CreateWorkshopAppointmentCommand } from '../../types';
import { listWorkshopCustomers, listWorkshopVehicles, createWorkshopAppointment } from '../../services/workshopOperations';

export interface ManualAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onAppointmentCreated: (appt: WorkshopAppointmentResponse) => void;
  initialDate?: string;
  initialTime?: string;
  initialCustomerId?: string;
  initialVehicleId?: string;
}

export const ManualAppointmentModal: React.FC<ManualAppointmentModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onAppointmentCreated,
  initialDate,
  initialTime,
  initialCustomerId,
  initialVehicleId,
}) => {
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(initialTime || '09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [serviceIntent, setServiceIntent] = useState('Revisión periódica y diagnosis');
  const [notes, setNotes] = useState('');

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>(initialCustomerId ? 'existing' : 'new');
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [vehicleMode, setVehicleMode] = useState<'existing' | 'new'>(initialVehicleId ? 'existing' : 'new');
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || '');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  const [existingCustomers, setExistingCustomers] = useState<WorkshopCustomer[]>([]);
  const [existingVehicles, setExistingVehicles] = useState<WorkshopVehicle[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialCustomerId) {
        setCustomerMode('existing');
        setSelectedCustomerId(initialCustomerId);
      }
      if (initialVehicleId) {
        setVehicleMode('existing');
        setSelectedVehicleId(initialVehicleId);
      }
      if (tenantId) {
        Promise.all([
          listWorkshopCustomers(tenantId),
          listWorkshopVehicles(tenantId),
        ]).then(([cRes, vRes]) => {
          if (cRes.status === 'success' && cRes.data) setExistingCustomers(cRes.data);
          if (vRes.status === 'success' && vRes.data) setExistingVehicles(vRes.data);
        });
      }
    }
  }, [isOpen, tenantId, initialCustomerId, initialVehicleId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const startObj = new Date(year, month - 1, day, hours, minutes);
      const startAtIso = startObj.toISOString();

      const idempotencyKey = `manual-appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const command: CreateWorkshopAppointmentCommand = {
        idempotencyKey,
        startAt: startAtIso,
        durationMinutes,
        serviceIntent: serviceIntent.trim() || 'Intervención de taller',
        notes: notes.trim() || undefined,
        customerId: customerMode === 'existing' && selectedCustomerId ? selectedCustomerId : undefined,
        vehicleId: vehicleMode === 'existing' && selectedVehicleId ? selectedVehicleId : undefined,
        customerSnapshot: customerMode === 'new' && customerName.trim() ? {
          name: customerName.trim(),
          phone: customerPhone.trim() || undefined,
        } : undefined,
        vehicleSnapshot: vehicleMode === 'new' && (vehiclePlate.trim() || vehicleMake.trim() || vehicleModel.trim()) ? {
          plate: vehiclePlate.trim() || undefined,
          make: vehicleMake.trim() || undefined,
          model: vehicleModel.trim() || undefined,
        } : undefined,
      };

      const res = await createWorkshopAppointment(tenantId, command);
      if (res.status === 'success' && res.data) {
        onAppointmentCreated(res.data);
        onClose();
      } else {
        setErrorMessage(res.message || 'Error al agendar la cita.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado al crear la cita.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-xl text-blue-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Nueva Cita Directa</h2>
              <p className="text-xs text-slate-400">Agendar directamente en el taller (presencial o teléfono fijo)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Fecha de la cita</label>
              <input
                type="date"
                value={date}
                required
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Hora de entrada</label>
              <input
                type="time"
                value={time}
                required
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* Duration & Motivo */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Duración (min)</label>
              <select
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min (1h)</option>
                <option value={90}>90 min (1.5h)</option>
                <option value={120}>120 min (2h)</option>
                <option value={180}>180 min (3h)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Motivo / Intervención</label>
              <input
                type="text"
                value={serviceIntent}
                required
                onChange={e => setServiceIntent(e.target.value)}
                placeholder="Ej: Cambio de aceite, ruidos en frenos..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>
          </div>

          {/* Customer */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Cliente
              </span>
              <div className="flex bg-slate-200 p-0.5 rounded-lg text-2xs font-bold">
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`px-2 py-0.5 rounded-md transition ${customerMode === 'new' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Directo
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`px-2 py-0.5 rounded-md transition ${customerMode === 'existing' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Ficha Taller
                </button>
              </div>
            </div>

            {customerMode === 'existing' ? (
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
              >
                <option value="">-- Seleccionar cliente guardado --</option>
                {existingCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="Teléfono de contacto"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                />
              </div>
            )}
          </div>

          {/* Vehicle */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-emerald-600" />
                Vehículo
              </span>
              <div className="flex bg-slate-200 p-0.5 rounded-lg text-2xs font-bold">
                <button
                  type="button"
                  onClick={() => setVehicleMode('new')}
                  className={`px-2 py-0.5 rounded-md transition ${vehicleMode === 'new' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Directo
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleMode('existing')}
                  className={`px-2 py-0.5 rounded-md transition ${vehicleMode === 'existing' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Ficha Taller
                </button>
              </div>
            </div>

            {vehicleMode === 'existing' ? (
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
              >
                <option value="">-- Seleccionar vehículo guardado --</option>
                {existingVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.plate || 'Sin matrícula'} — {[v.make, v.model].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={e => setVehiclePlate(e.target.value)}
                  placeholder="Matrícula"
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-mono uppercase"
                />
                <input
                  type="text"
                  value={vehicleMake}
                  onChange={e => setVehicleMake(e.target.value)}
                  placeholder="Marca"
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                />
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={e => setVehicleModel(e.target.value)}
                  placeholder="Modelo"
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                />
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Notas internas de taller</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Instrucciones para recepción o mecánicos..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Agendando...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Guardar Cita en Agenda</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
