import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, AlertCircle, Phone, Truck, Wrench, Shield, User, Car } from 'lucide-react';
import {
  createReceptionCase,
  type ReceptionCase,
  type ReceptionCaseCallerType,
  type ReceptionCaseCategory,
  type ReceptionCasePriority,
} from '../../services/receptionCases';
import type { WorkshopCustomer, WorkshopVehicle } from '../../types';
import { listWorkshopCustomers, listWorkshopVehicles } from '../../services/workshopOperations';

export interface ManualReceptionCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onCaseCreated: (createdCase: ReceptionCase) => void;
  initialCallerType?: ReceptionCaseCallerType;
  initialCategory?: ReceptionCaseCategory;
  initialCustomerId?: string | null;
  initialVehicleId?: string | null;
}

const CALLER_LABELS: Record<ReceptionCaseCallerType, string> = {
  CUSTOMER: 'Cliente',
  SUPPLIER: 'Proveedor',
  TOW_TRANSPORT: 'Grúa / Transporte',
  INSURER_ASSESSOR: 'Perito / Seguro',
  RENTING_FLEET: 'Renting / Flota',
  OTHER_WORKSHOP: 'Otro Taller',
  COMMERCIAL: 'Comercial',
  OTHER: 'Otro interlocutor',
};

const CATEGORY_LABELS: Record<ReceptionCaseCategory, string> = {
  callback_request: 'Solicitud de llamada (Callback)',
  appointment_issue: 'Cita / Horario',
  late_arrival: 'Llegada con retraso',
  vehicle_status_question: 'Estado del vehículo',
  estimate_question: 'Presupuesto / Precio',
  additional_vehicle_issue: 'Avería adicional comunicada',
  supplier_message: 'Mensaje de proveedor',
  parts_delivery: 'Entrega de recambios',
  tow_delivery: 'Llegada de grúa / vehículo',
  insurance_assessor: 'Peritaje / Seguros',
  administration_invoice: 'Facturación / Administración',
  missed_call_return: 'Devolución llamada perdida',
  commercial: 'Gestión comercial',
  other: 'Asunto general',
};

export const ManualReceptionCaseModal: React.FC<ManualReceptionCaseModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onCaseCreated,
  initialCallerType = 'CUSTOMER',
  initialCategory = 'other',
  initialCustomerId = null,
  initialVehicleId = null,
}) => {
  const [callerType, setCallerType] = useState<ReceptionCaseCallerType>(initialCallerType);
  const [category, setCategory] = useState<ReceptionCaseCategory>(initialCategory);
  const [priority, setPriority] = useState<ReceptionCasePriority>('NORMAL');
  const [summary, setSummary] = useState('');
  const [detail, setDetail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(initialVehicleId);

  // Directory lists for linking
  const [customers, setCustomers] = useState<WorkshopCustomer[]>([]);
  const [vehicles, setVehicles] = useState<WorkshopVehicle[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Idempotency key per logical submit attempt: preserved during retries, regenerated on success/reset
  const idempotencyKeyRef = useRef<string>(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sub-' + Date.now());

  useEffect(() => {
    if (isOpen) {
      setCallerType(initialCallerType);
      setCategory(initialCategory);
      setPriority('NORMAL');
      setSummary('');
      setDetail('');
      setContactPhone('');
      setContactPerson('');
      setSelectedCustomerId(initialCustomerId);
      setSelectedVehicleId(initialVehicleId);
      setErrorMessage(null);
      setIsSubmitting(false);
      idempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sub-' + Date.now();

      // Load customers and vehicles for linking option
      if (tenantId) {
        listWorkshopCustomers(tenantId, { limit: 100 }).then(res => {
          if (res.status === 'success' && res.data) setCustomers(res.data);
        }).catch(() => {});
        listWorkshopVehicles(tenantId, { limit: 100 }).then(res => {
          if (res.status === 'success' && res.data) setVehicles(res.data);
        }).catch(() => {});
      }
    }
  }, [isOpen, initialCallerType, initialCategory, initialCustomerId, initialVehicleId, tenantId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setErrorMessage('Por favor, indica un resumen del asunto.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const contactContext: Record<string, string> = {};
    if (contactPhone.trim()) contactContext.phone = contactPhone.trim();
    if (contactPerson.trim()) contactContext.contactPerson = contactPerson.trim();

    try {
      const res = await createReceptionCase(tenantId, {
        callerType,
        category,
        priority,
        summary: summary.trim(),
        detail: detail.trim() || undefined,
        customerId: selectedCustomerId || null,
        vehicleId: selectedVehicleId || null,
        contactContext: Object.keys(contactContext).length > 0 ? contactContext : undefined,
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (res.status === 'success' && res.data) {
        // Regenerate key for next attempt
        idempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sub-' + Date.now();
        onCaseCreated(res.data);
        onClose();
      } else {
        setErrorMessage(res.message || 'Error al guardar el asunto en recepción.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado de conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Nuevo Asunto en Recepción</h3>
              <p className="text-xs text-slate-500">Registrar llamada, recambio o gestión pendiente para el taller</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
              <p className="text-[11px] text-rose-600 mt-0.5">Puedes corregir o reintentar el envío.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Quick presets for common tasks */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Plantillas Rápidas
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCallerType('CUSTOMER');
                  setCategory('callback_request');
                  setPriority('HIGH');
                  if (!summary) setSummary('Llamar a cliente');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg font-medium transition"
              >
                📞 Llamar a cliente
              </button>
              <button
                type="button"
                onClick={() => {
                  setCallerType('SUPPLIER');
                  setCategory('supplier_message');
                  setPriority('NORMAL');
                  if (!summary) setSummary('Preguntar disponibilidad a proveedor');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg font-medium transition"
              >
                🚚 Preguntar a proveedor
              </button>
              <button
                type="button"
                onClick={() => {
                  setCallerType('TOW_TRANSPORT');
                  setCategory('tow_delivery');
                  setPriority('HIGH');
                  if (!summary) setSummary('Recepción de vehículo en grúa');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg font-medium transition"
              >
                🪝 Llegada de grúa
              </button>
              <button
                type="button"
                onClick={() => {
                  setCallerType('OTHER');
                  setCategory('administration_invoice');
                  setPriority('NORMAL');
                  if (!summary) setSummary('Revisar factura');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg font-medium transition"
              >
                📄 Revisar factura
              </button>
            </div>
          </div>

          {/* Caller Type & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Tipo de Interlocutor *
              </label>
              <select
                value={callerType}
                onChange={e => setCallerType(e.target.value as ReceptionCaseCallerType)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
              >
                {Object.entries(CALLER_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Prioridad *
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as ReceptionCasePriority)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
              >
                <option value="LOW">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Categoría del Asunto *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as ReceptionCaseCategory)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Qué quiere / Resumen *
            </label>
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Ej: Llamar para comentar el presupuesto, o Llega alternador mañana"
              maxLength={500}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>

          {/* Detail */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Detalle o Notas adicionales
            </label>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Notas relevantes para el taller..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white resize-none font-medium"
            />
          </div>

          {/* Contact Details (Especially for callbacks / suppliers) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Contacto directo (Callback / Interlocutor)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="Teléfono (ej: 600123456)"
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
              />
              <input
                type="text"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="Nombre de contacto o empresa"
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          {/* Optional Entity Links (Customers & Vehicles) */}
          {callerType === 'CUSTOMER' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Asociar a Cliente o Vehículo (Opcional)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Cliente existente</label>
                  <select
                    value={selectedCustomerId || ''}
                    onChange={e => setSelectedCustomerId(e.target.value || null)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium"
                  >
                    <option value="">— Ninguno o no registrado —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Vehículo existente</label>
                  <select
                    value={selectedVehicleId || ''}
                    onChange={e => setSelectedVehicleId(e.target.value || null)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium"
                  >
                    <option value="">— Ninguno o no registrado —</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate || 'Sin matrícula'} {v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !summary.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Asunto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
