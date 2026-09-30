import React, { useState } from 'react';
import { X, Plus, Car, AlertCircle } from 'lucide-react';
import type { WorkshopVehicle, WorkshopCustomer } from '../../types';
import { createWorkshopVehicle, listWorkshopCustomers } from '../../services/workshopOperations';

export interface ManualVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onVehicleCreated: (vehicle: WorkshopVehicle) => void;
  initialPlate?: string;
  initialMake?: string;
  initialModel?: string;
  initialYear?: number;
  initialVin?: string;
  initialCustomerId?: string;
}

export const ManualVehicleModal: React.FC<ManualVehicleModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onVehicleCreated,
  initialPlate = '',
  initialMake = '',
  initialModel = '',
  initialYear,
  initialVin = '',
  initialCustomerId,
}) => {
  const [plate, setPlate] = useState(initialPlate);
  const [make, setMake] = useState(initialMake);
  const [model, setModel] = useState(initialModel);
  const [year, setYear] = useState<string>(initialYear ? String(initialYear) : '');
  const [vin, setVin] = useState(initialVin);
  const [customerId, setCustomerId] = useState<string>(initialCustomerId || '');

  const [customers, setCustomers] = useState<WorkshopCustomer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingVehicle, setExistingVehicle] = useState<WorkshopVehicle | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPlate(initialPlate);
      setMake(initialMake);
      setModel(initialModel);
      setYear(initialYear ? String(initialYear) : '');
      setVin(initialVin);
      setCustomerId(initialCustomerId || '');
      setErrorMessage(null);
      setExistingVehicle(null);
      setIsSubmitting(false);
      listWorkshopCustomers(tenantId).then(res => {
        if (res.status === 'success' && res.data) {
          setCustomers(Array.isArray(res.data) ? res.data : []);
        }
      }).catch(() => {
        // non-blocking
      });
    }
  }, [isOpen, tenantId, initialPlate, initialMake, initialModel, initialYear, initialVin, initialCustomerId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = plate.trim().toUpperCase() || undefined;
    const cleanMake = make.trim() || undefined;
    const cleanModel = model.trim() || undefined;
    const cleanVin = vin.trim().toUpperCase() || undefined;
    const cleanYear = year ? parseInt(year, 10) : undefined;

    if (!cleanPlate && !cleanVin && (!cleanMake || !cleanModel)) {
      setErrorMessage('Debes indicar al menos una matrícula, un número de bastidor (VIN), o la marca y modelo.');
      return;
    }

    setErrorMessage(null);
    setExistingVehicle(null);
    setIsSubmitting(true);

    try {
      const res = await createWorkshopVehicle(tenantId, {
        plate: cleanPlate,
        make: cleanMake,
        model: cleanModel,
        year: cleanYear,
        vin: cleanVin,
        customerId: customerId || undefined,
      });

      if (res.status === 'success' && res.data) {
        onVehicleCreated(res.data);
        onClose();
      } else if (res.status === 'conflict' || res.code === 'VEHICLE_PLATE_EXISTS' || res.code === 'VEHICLE_VIN_EXISTS') {
        const found = res.existingVehicle || (res as any).data?.existingVehicle;
        if (found) {
          setExistingVehicle(found);
          setErrorMessage(`${res.message || 'El vehículo ya existe'}. Puedes seleccionarlo directamente.`);
        } else {
          setErrorMessage(res.message || 'El vehículo ya existe en este taller.');
        }
      } else {
        setErrorMessage(res.message || 'Error al guardar el vehículo.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error de red al guardar el vehículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 rounded-xl text-blue-400">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold">Nuevo Vehículo en Taller</h2>
              <p className="text-2xs text-slate-400">Matrícula y VIN protegidos criptográficamente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {existingVehicle && (
                <button
                  type="button"
                  onClick={() => {
                    onVehicleCreated(existingVehicle);
                    onClose();
                  }}
                  className="mt-1 px-3 py-1.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 text-2xs self-start"
                >
                  Usar vehículo existente ({existingVehicle.plate || existingVehicle.vin || `${existingVehicle.make} ${existingVehicle.model}`})
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Matrícula</label>
              <input
                type="text"
                value={plate}
                onChange={e => setPlate(e.target.value.toUpperCase())}
                placeholder="1234BBB"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Año</label>
              <input
                type="number"
                min="1950"
                max="2035"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="Ej: 2021"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Marca</label>
              <input
                type="text"
                value={make}
                onChange={e => setMake(e.target.value)}
                placeholder="Ej: Seat"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Modelo</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="Ej: León 1.5 TSI"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">VIN / Nº de Bastidor</label>
            <input
              type="text"
              value={vin}
              onChange={e => setVin(e.target.value.toUpperCase())}
              placeholder="Ej: VSSZZZ5FZMR012345"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-blue-500 uppercase"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Propietario / Cliente (Opcional)</label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">-- Sin asignar / Asociar más tarde --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Vehículo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
