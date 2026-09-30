import React, { useState, useEffect } from 'react';
import { X, Plus, FileText, User, Car, AlertCircle, Sparkles } from 'lucide-react';
import type { WorkshopCustomer, WorkshopVehicle, CreateManualEstimateDraftCommand, EstimateDraft } from '../../types';
import { listWorkshopCustomers, listWorkshopVehicles } from '../../services/workshopOperations';
import { createManualEstimateDraft } from '../../services/repairKnowledge';

export interface ManualEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onDraftCreated: (draft: EstimateDraft) => void;
  initialTitle?: string;
  initialVehiclePlate?: string;
  initialVehicleMake?: string;
  initialVehicleModel?: string;
  initialVehicleId?: string;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  initialCustomerId?: string;
  initialAppointmentId?: string;
}

export const ManualEstimateModal: React.FC<ManualEstimateModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onDraftCreated,
  initialTitle = '',
  initialVehiclePlate = '',
  initialVehicleMake = '',
  initialVehicleModel = '',
  initialVehicleId = '',
  initialCustomerName = '',
  initialCustomerPhone = '',
  initialCustomerId = '',
  initialAppointmentId = '',
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>(initialCustomerId ? 'existing' : 'new');
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId);
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone);
  const [customerEmail, setCustomerEmail] = useState('');

  const [vehicleMode, setVehicleMode] = useState<'existing' | 'new'>(initialVehicleId ? 'existing' : 'new');
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId);
  const [vehiclePlate, setVehiclePlate] = useState(initialVehiclePlate);
  const [vehicleMake, setVehicleMake] = useState(initialVehicleMake);
  const [vehicleModel, setVehicleModel] = useState(initialVehicleModel);
  const [vehicleYear, setVehicleYear] = useState('');

  // Synchronize when opening with new props
  useEffect(() => {
    if (isOpen) {
      if (initialTitle) setTitle(initialTitle);
      if (initialCustomerId) {
        setCustomerMode('existing');
        setSelectedCustomerId(initialCustomerId);
      } else if (initialCustomerName || initialCustomerPhone) {
        setCustomerMode('new');
        if (initialCustomerName) setCustomerName(initialCustomerName);
        if (initialCustomerPhone) setCustomerPhone(initialCustomerPhone);
      }
      if (initialVehicleId) {
        setVehicleMode('existing');
        setSelectedVehicleId(initialVehicleId);
      } else if (initialVehiclePlate || initialVehicleMake || initialVehicleModel) {
        setVehicleMode('new');
        if (initialVehiclePlate) setVehiclePlate(initialVehiclePlate);
        if (initialVehicleMake) setVehicleMake(initialVehicleMake);
        if (initialVehicleModel) setVehicleModel(initialVehicleModel);
      }
    }
  }, [isOpen, initialTitle, initialCustomerId, initialCustomerName, initialCustomerPhone, initialVehicleId, initialVehiclePlate, initialVehicleMake, initialVehicleModel]);

  // Initial line (optional, defaults to empty)
  const [initialDescription, setInitialDescription] = useState('');
  const [initialLaborHours, setInitialLaborHours] = useState('');
  const [initialLaborPrice, setInitialLaborPrice] = useState('');

  const [existingCustomers, setExistingCustomers] = useState<WorkshopCustomer[]>([]);
  const [existingVehicles, setExistingVehicles] = useState<WorkshopVehicle[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tenantId) {
      setIsLoadingEntities(true);
      Promise.all([
        listWorkshopCustomers(tenantId),
        listWorkshopVehicles(tenantId),
      ]).then(([cRes, vRes]) => {
        if (cRes.status === 'success' && cRes.data) setExistingCustomers(cRes.data);
        if (vRes.status === 'success' && vRes.data) setExistingVehicles(vRes.data);
        setIsLoadingEntities(false);
      });
    }
  }, [isOpen, tenantId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const idempotencyKey = `manual-est-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const command: CreateManualEstimateDraftCommand = {
        kind: 'manual',
        idempotencyKey,
        title: title.trim() || 'Presupuesto de taller',
        customerId: customerMode === 'existing' && selectedCustomerId ? selectedCustomerId : undefined,
        vehicleId: vehicleMode === 'existing' && selectedVehicleId ? selectedVehicleId : undefined,
        appointmentId: initialAppointmentId || undefined,
        customerSnapshot: customerMode === 'new' && (customerName.trim() || customerPhone.trim() || customerEmail.trim()) ? {
          name: customerName.trim() || undefined,
          phone: customerPhone.trim() || undefined,
          email: customerEmail.trim() || undefined,
        } : undefined,
        vehicleSnapshot: vehicleMode === 'new' && (vehiclePlate.trim() || vehicleMake.trim() || vehicleModel.trim()) ? {
          plate: vehiclePlate.trim() || undefined,
          make: vehicleMake.trim() || undefined,
          model: vehicleModel.trim() || undefined,
          year: vehicleYear ? parseInt(vehicleYear, 10) : undefined,
        } : undefined,
        lines: initialDescription.trim() ? [
          {
            mutationKey: `manual-init-${Date.now()}`,
            description: initialDescription.trim(),
            itemType: 'LABOR',
            quantity: initialLaborHours ? parseFloat(initialLaborHours) : 1.0,
            unitPrice: initialLaborPrice ? parseFloat(initialLaborPrice) : null,
            currency: 'EUR',
            selected: true,
          }
        ] : undefined,
      };

      const res = await createManualEstimateDraft(tenantId, command);
      if (res.status === 'success' && res.data) {
        onDraftCreated(res.data);
        onClose();
      } else {
        setErrorMessage(res.message || 'Error al crear el borrador manual.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado al crear el presupuesto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-xl text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Nuevo Presupuesto Manual</h2>
              <p className="text-xs text-slate-400">Crea un borrador libre sin dependencias técnicas de RK</p>
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Título de la intervención</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Mantenimiento anual, diagnosis eléctrica, reparación frenos..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-semibold"
            />
          </div>

          {/* Customer Section */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                Cliente (opcional)
              </span>
              <div className="flex bg-slate-200 p-0.5 rounded-lg text-2xs font-bold">
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`px-2.5 py-1 rounded-md transition ${customerMode === 'new' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Directo
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`px-2.5 py-1 rounded-md transition ${customerMode === 'existing' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Ficha Taller
                </button>
              </div>
            </div>

            {customerMode === 'existing' ? (
              <div>
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
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="Teléfono (ej: 600112233)"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Vehicle Section */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-emerald-600" />
                Vehículo (opcional)
              </span>
              <div className="flex bg-slate-200 p-0.5 rounded-lg text-2xs font-bold">
                <button
                  type="button"
                  onClick={() => setVehicleMode('new')}
                  className={`px-2.5 py-1 rounded-md transition ${vehicleMode === 'new' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Directo
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleMode('existing')}
                  className={`px-2.5 py-1 rounded-md transition ${vehicleMode === 'existing' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Ficha Taller
                </button>
              </div>
            </div>

            {vehicleMode === 'existing' ? (
              <div>
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
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={e => setVehiclePlate(e.target.value)}
                    placeholder="Matrícula (ej: 1234-BBB)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-mono uppercase"
                  />
                  <input
                    type="number"
                    value={vehicleYear}
                    onChange={e => setVehicleYear(e.target.value)}
                    placeholder="Año (ej: 2018)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={vehicleMake}
                    onChange={e => setVehicleMake(e.target.value)}
                    placeholder="Marca (ej: Renault)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                  />
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={e => setVehicleModel(e.target.value)}
                    placeholder="Modelo (ej: Megane)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Initial Labor Line (Optional) */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-bold text-slate-800 block">Línea inicial (Opcional)</span>
              <span className="text-2xs text-slate-400">Puedes crear el presupuesto vacío y añadir partidas después</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={initialDescription}
                  onChange={e => setInitialDescription(e.target.value)}
                  placeholder="Ej: Revisión general (dejar vacío para empezar en blanco)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={initialLaborHours}
                  onChange={e => setInitialLaborHours(e.target.value)}
                  placeholder="Horas (1.0)"
                  title="Horas de trabajo"
                  className="w-1/2 px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs text-center font-mono"
                />
                <input
                  type="number"
                  step="1"
                  value={initialLaborPrice}
                  onChange={e => setInitialLaborPrice(e.target.value)}
                  placeholder="€/h (50)"
                  title="Precio por hora (€)"
                  className="w-1/2 px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs text-center font-mono"
                />
              </div>
            </div>
          </div>

          {/* Footer buttons */}
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
                <span>Creando borrador...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Crear Borrador Guardado</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
