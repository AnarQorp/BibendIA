import React, { useState } from 'react';
import { X, Plus, User, AlertCircle } from 'lucide-react';
import type { WorkshopCustomer } from '../../types';
import { createWorkshopCustomer } from '../../services/workshopOperations';

export interface ManualCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onCustomerCreated: (customer: WorkshopCustomer) => void;
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
}

export const ManualCustomerModal: React.FC<ManualCustomerModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onCustomerCreated,
  initialName = '',
  initialPhone = '',
  initialEmail = '',
}) => {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setPhone(initialPhone);
      setEmail(initialEmail);
      setNotes('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialName, initialPhone, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('El nombre del cliente es obligatorio.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await createWorkshopCustomer(tenantId, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.status === 'success' && res.data) {
        onCustomerCreated(res.data);
        onClose();
      } else {
        setErrorMessage(res.message || 'Error al guardar el cliente.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error de red al guardar cliente.');
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
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold">Nuevo Cliente en Taller</h2>
              <p className="text-2xs text-slate-400">Datos protegidos criptográficamente (AES-GCM)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Nombre completo *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Laura Sánchez Martín"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Teléfono móvil</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ej: 600123456"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Ej: laura@ejemplo.com"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notas internas de taller</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones de contacto o preferencias..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
            />
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
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Cliente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
