import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, Clock, User, Car, AlertCircle, Wrench } from 'lucide-react';
import type { WorkshopCustomer, WorkshopVehicle, WorkshopAppointmentResponse, CreateWorkshopAppointmentCommand, CanonicalServiceIntent } from '../../types';
import { listWorkshopCustomers, listWorkshopVehicles, createWorkshopAppointment } from '../../services/workshopOperations';

export interface ManualAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string | null;
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
  const [serviceIntent, setServiceIntent] = useState<CanonicalServiceIntent>('inspection');
  const [customerWaitMode, setCustomerWaitMode] = useState<'DROP_OFF' | 'WAIT_ON_SITE'>('DROP_OFF');
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
    if (!tenantId) {
      setErrorMessage('Se requiere un identificador de taller activo para persistir la cita.');
      return;
    }
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
        serviceIntent,
        customerWaitMode,
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
        const msg = res.message || '';
        if (msg.includes('capacidad') || msg.includes('CAPACITY') || msg.includes('422')) {
          setErrorMessage('No hay capacidad disponible a esa hora.');
        } else {
          setErrorMessage(msg || 'Error al agendar la cita.');
        }
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('capacidad') || msg.includes('CAPACITY') || msg.includes('422')) {
        setErrorMessage('No hay capacidad disponible a esa hora.');
      } else {
        setErrorMessage(msg || 'Error inesperado al crear la cita.');
      }
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

          {/* Tipo de Intervención (Canónico) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-bold text-slate-700">Tipo de intervención</label>
              <span className="text-2xs text-slate-500 font-medium">Duración calculada por política del taller</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'inspection', label: 'Revisión / inspección', desc: 'Revisión periódica y diagnosis' },
                { id: 'oil_service', label: 'Cambio de aceite / mantenimiento', desc: 'Fluidos y filtros programados' },
                { id: 'brakes_or_noise', label: 'Frenos o ruidos', desc: 'Pastillas, discos o ruidos anómalos' },
                { id: 'generic_fault', label: 'Avería / trabajo general', desc: 'Reparaciones generales de taller' },
              ].map(opt => {
                const isSelected = serviceIntent === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setServiceIntent(opt.id as CanonicalServiceIntent)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs">{opt.label}</span>
                    <span className="text-3xs text-slate-500 mt-0.5">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modo de Espera del Cliente */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Modo de estancia del cliente</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCustomerWaitMode('DROP_OFF')}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  customerWaitMode === 'DROP_OFF'
                    ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${customerWaitMode === 'DROP_OFF' ? 'bg-blue-600' : 'bg-slate-300'}`} />
                <span>Deja el coche</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerWaitMode('WAIT_ON_SITE')}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  customerWaitMode === 'WAIT_ON_SITE'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${customerWaitMode === 'WAIT_ON_SITE' ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                <span>Espera en taller</span>
              </button>
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

          {/* Motivo detallado / Observaciones */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Motivo detallado / observaciones</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej: Ruido metálico al frenar a baja velocidad, revisión 60.000 km, instrucciones..."
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
