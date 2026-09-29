import React, { useState, useEffect } from 'react';
import { useDemo } from '../../context/DemoContext';
import type { Quote, QuoteItem, EstimateAutomationStatus, RepairEvidence } from '../../types';
import { 
  FileText, 
  Check, 
  Send, 
  Plus, 
  Car, 
  User, 
  Clock, 
  Wrench, 
  Edit2, 
  Sparkles, 
  ChevronLeft,
  Trash2,
  Save,
  X,
  AlertCircle,
  Database,
  Info,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Ban,
  CheckCircle2
} from 'lucide-react';
import { RepairKnowledgeFlowModal } from './RepairKnowledgeFlowModal';
import { RepairEvidenceModal } from './RepairEvidenceModal';
import { patchEstimateDraftLine } from '../../services/repairKnowledge';

export const PresupuestosView: React.FC = () => {
  const {
    quotes,
    customers,
    vehicles,
    approveQuote,
    updateQuote,
    addQuote,
    deleteQuote,
    generateQuoteFromPrompt
  } = useDemo();

  // Tenant ID resolution for workshop operations
  const [tenantId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('tenant');
      if (fromUrl) return fromUrl;
      return localStorage.getItem('bibendia_tenant_id') || '00000000-0000-0000-0000-000000000001';
    }
    return '00000000-0000-0000-0000-000000000001';
  });

  const [promptInput, setPromptInput] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(quotes[0]?.id || '');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'pending_approval' | 'sent'>('all');

  // Modals state
  const [isRkModalOpen, setIsRkModalOpen] = useState(false);
  const [evidenceModalItem, setEvidenceModalItem] = useState<{
    title: string;
    itemType?: string;
    repairBomEdgeId?: string;
    confidenceState?: string;
    automationStatus?: EstimateAutomationStatus;
    reviewRequired?: boolean;
    confidenceReason?: string;
    condition?: string | null;
    notes?: string | null;
    evidence?: RepairEvidence[];
  } | null>(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Quote | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Sync selectedQuoteId if quotes change
  useEffect(() => {
    if (!selectedQuoteId && quotes.length > 0) {
      setSelectedQuoteId(quotes[0].id);
    }
  }, [quotes, selectedQuoteId]);

  const activeQuote = quotes.find(q => q.id === selectedQuoteId) || quotes[0];
  const customer = customers.find(c => c.id === activeQuote?.customerId);
  const vehicle = vehicles.find(v => v.id === activeQuote?.vehicleId);

  const filteredQuotes = quotes.filter(q => {
    if (statusFilter === 'all') return true;
    return q.status === statusFilter;
  });

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promptInput.trim()) {
      generateQuoteFromPrompt(promptInput);
      setPromptInput('');
      setMobileView('detail');
      setFeedbackNotice({ type: 'success', text: 'Borrador de presupuesto generado. Puedes editarlo antes de aprobar.' });
    }
  };

  const handleStartNewQuote = () => {
    const newId = `q-${Date.now()}`;
    const nextNumber = `PRE-2026-${String(quotes.length + 1).padStart(3, '0')}`;
    const blankQuote: Quote = {
      id: newId,
      number: nextNumber,
      customerId: '',
      vehicleId: '',
      customerName: 'Cliente Taller',
      vehiclePlate: '0000-XXX',
      title: 'Intervención de Taller',
      createdDate: 'Hoy',
      status: 'draft',
      items: [
        {
          id: `item-${Date.now()}-1`,
          category: 'part',
          description: 'Recambio principal',
          quantity: 1,
          unitPrice: null, // Pending by default
          total: null,
          pricingStatus: 'PENDING',
          isLocallyModified: false
        },
        {
          id: `item-${Date.now()}-2`,
          category: 'labor',
          description: 'Mano de obra (sustitución y montaje)',
          quantity: 1.0,
          unitPrice: 50.0,
          total: 50.0,
          pricingStatus: 'MANUALLY_PRICED',
          isLocallyModified: false
        }
      ],
      subtotal: 50.0,
      tax: 10.5,
      total: 60.5,
      estimatedLaborHours: 1.0,
      aiRationale: 'Presupuesto nuevo en borrador manual.',
      isPersistedBackendDraft: false,
      hasUnsavedLocalChanges: false
    };
    addQuote(blankQuote);
    setSelectedQuoteId(newId);
    setEditForm(JSON.parse(JSON.stringify(blankQuote)));
    setIsEditing(true);
    setMobileView('detail');
    setFeedbackNotice({ type: 'success', text: `Nuevo presupuesto ${nextNumber} creado en modo borrador.` });
  };

  const handleStartEditing = () => {
    if (!activeQuote) return;
    setEditForm(JSON.parse(JSON.stringify(activeQuote)));
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const handleItemChange = (index: number, field: keyof QuoteItem, value: any) => {
    if (!editForm) return;
    const newItems = [...editForm.items];
    const target = { ...newItems[index] };

    if (field === 'quantity') {
      const qVal = value === '' ? null : parseFloat(value);
      target.quantity = qVal;
      if (target.unitPrice !== null && qVal !== null) {
        target.total = Math.round(qVal * target.unitPrice * 100) / 100;
      } else {
        target.total = null;
      }
      target.isLocallyModified = true;
    } else if (field === 'unitPrice') {
      if (value === '' || value === null) {
        target.unitPrice = null;
        target.total = null;
        target.pricingStatus = 'PENDING';
      } else {
        const uVal = parseFloat(value) || 0;
        target.unitPrice = uVal;
        target.total = target.quantity !== null ? Math.round(target.quantity * uVal * 100) / 100 : null;
        target.pricingStatus = 'MANUALLY_PRICED';
      }
      target.isLocallyModified = true;
    } else {
      (target as any)[field] = value;
      target.isLocallyModified = true;
    }

    newItems[index] = target;

    // Recalculate totals
    const pricedItems = newItems.filter(item => item.unitPrice !== null && item.quantity !== null && item.pricingStatus !== 'PENDING');
    const hasPending = newItems.some(item => item.unitPrice === null || item.pricingStatus === 'PENDING');

    let subtotal: number | null = null;
    let tax: number | null = null;
    let total: number | null = null;

    if (pricedItems.length > 0 || !hasPending) {
      subtotal = Math.round(pricedItems.reduce((acc, item) => acc + (item.total ?? 0), 0) * 100) / 100;
      tax = Math.round(subtotal * 0.21 * 100) / 100;
      total = Math.round((subtotal + tax) * 100) / 100;
    }

    const laborHours = newItems
      .filter(item => item.category === 'labor')
      .reduce((acc, item) => acc + (item.quantity ?? 0), 0);

    setEditForm({
      ...editForm,
      items: newItems,
      subtotal,
      tax,
      total,
      estimatedLaborHours: laborHours > 0 ? laborHours : editForm.estimatedLaborHours,
      hasUnsavedLocalChanges: editForm.isPersistedBackendDraft ? true : editForm.hasUnsavedLocalChanges
    });
  };

  const handleAddItem = (category: 'part' | 'labor') => {
    if (!editForm) return;
    const newItem: QuoteItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      description: category === 'part' ? 'Nuevo recambio / material' : 'Operación de mano de obra',
      quantity: 1,
      unitPrice: category === 'part' ? null : 50.0,
      total: category === 'part' ? null : 50.0,
      pricingStatus: category === 'part' ? 'PENDING' : 'MANUALLY_PRICED',
      isLocallyModified: true
    };
    const newItems = [...editForm.items, newItem];
    const pricedItems = newItems.filter(item => item.unitPrice !== null && item.quantity !== null && item.pricingStatus !== 'PENDING');
    const hasPending = newItems.some(item => item.unitPrice === null || item.pricingStatus === 'PENDING');

    let subtotal: number | null = null;
    let tax: number | null = null;
    let total: number | null = null;

    if (pricedItems.length > 0 || !hasPending) {
      subtotal = Math.round(pricedItems.reduce((acc, item) => acc + (item.total ?? 0), 0) * 100) / 100;
      tax = Math.round(subtotal * 0.21 * 100) / 100;
      total = Math.round((subtotal + tax) * 100) / 100;
    }

    setEditForm({
      ...editForm,
      items: newItems,
      subtotal,
      tax,
      total,
      hasUnsavedLocalChanges: editForm.isPersistedBackendDraft ? true : editForm.hasUnsavedLocalChanges
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!editForm) return;
    if (editForm.items.length <= 1) {
      alert('El presupuesto debe contener al menos una partida.');
      return;
    }
    const newItems = editForm.items.filter((_, i) => i !== index);
    const pricedItems = newItems.filter(item => item.unitPrice !== null && item.quantity !== null && item.pricingStatus !== 'PENDING');
    const hasPending = newItems.some(item => item.unitPrice === null || item.pricingStatus === 'PENDING');

    let subtotal: number | null = null;
    let tax: number | null = null;
    let total: number | null = null;

    if (pricedItems.length > 0 || !hasPending) {
      subtotal = Math.round(pricedItems.reduce((acc, item) => acc + (item.total ?? 0), 0) * 100) / 100;
      tax = Math.round(subtotal * 0.21 * 100) / 100;
      total = Math.round((subtotal + tax) * 100) / 100;
    }

    setEditForm({
      ...editForm,
      items: newItems,
      subtotal,
      tax,
      total,
      hasUnsavedLocalChanges: editForm.isPersistedBackendDraft ? true : editForm.hasUnsavedLocalChanges
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;

    // Check if quote was a persistent backend draft
    if (editForm.isPersistedBackendDraft && editForm.backendDraftId) {
      // Prepared frontend call for future PATCH endpoint
      await patchEstimateDraftLine(tenantId, editForm.backendDraftId, '', {});
      
      const formToSave: Quote = {
        ...editForm,
        hasUnsavedLocalChanges: true
      };
      updateQuote(formToSave);
      setIsEditing(false);
      setEditForm(null);
      setFeedbackNotice({
        type: 'warning',
        text: `Modificaciones guardadas en navegador. Aviso técnico: El backend RK03 aún no expone PATCH /estimate-drafts, por lo que las mutaciones manuales no están persistidas en servidor.`
      });
      return;
    }

    updateQuote(editForm);
    setIsEditing(false);
    setEditForm(null);
    setFeedbackNotice({
      type: 'success',
      text: `Presupuesto ${editForm.number} guardado correctamente en almacenamiento local.`
    });
  };

  const handleDeleteActiveQuote = () => {
    if (!activeQuote) return;
    if (window.confirm(`¿Seguro que deseas eliminar el presupuesto ${activeQuote.number}?`)) {
      deleteQuote(activeQuote.id);
      setSelectedQuoteId(quotes[0]?.id || '');
      setIsEditing(false);
      setEditForm(null);
      setFeedbackNotice({ type: 'success', text: `Presupuesto ${activeQuote.number} eliminado.` });
    }
  };

  const handleDraftCreatedFromRK = (newQuote: Quote) => {
    addQuote(newQuote);
    setSelectedQuoteId(newQuote.id);
    setMobileView('detail');
    setFeedbackNotice({
      type: 'success',
      text: `Borrador técnico ${newQuote.number} creado e idempotente en backend (RK03). Precios pendientes de valoración.`
    });
  };

  const getStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300">
            Borrador Taller
          </span>
        );
      case 'pending_approval':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
            Revisión Pendiente
          </span>
        );
      case 'sent':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" /> Enviado por WhatsApp
          </span>
        );
      case 'accepted':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
            Aceptado por Cliente
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getLiteralStatusBadge = (status?: EstimateAutomationStatus) => {
    switch (status) {
      case 'AUTO_INCLUDED':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            AUTO_INCLUDED
          </span>
        );
      case 'OPTIONAL':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-300">
            OPTIONAL
          </span>
        );
      case 'REVIEW_REQUIRED':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
            REVIEW_REQUIRED
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
            BLOCKED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fadeIn">
      
      {/* Top Banner & Generation CTAs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Presupuestos de Taller</h2>
                <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                  Repair Knowledge (RK03) Activo
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Flujo técnico: Consulta de manuales oficiales, inclusión preceptiva de piezas y creación de borradores persistentes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {/* Primary RK Button */}
            <button
              onClick={() => setIsRkModalOpen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>+ Nuevo con Repair Knowledge</span>
            </button>

            {/* Secondary Manual Draft Button */}
            <button
              onClick={handleStartNewQuote}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-300 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Borrador Manual</span>
            </button>
          </div>
        </div>

        {/* Natural Language Prompt Form */}
        <form onSubmit={handleGenerateSubmit} className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100">
          <input
            type="text"
            value={promptInput}
            onChange={e => setPromptInput(e.target.value)}
            placeholder="O escribe una instrucción: 'Presupuesto kit distribución con bomba de agua para Golf VII CLHA...'"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
          />
          <button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Generar Rápido</span>
          </button>
        </form>
      </div>

      {/* Action Notification Banner */}
      {feedbackNotice && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          feedbackNotice.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : feedbackNotice.type === 'warning'
            ? 'bg-amber-50 text-amber-900 border-amber-300'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <span>{feedbackNotice.text}</span>
          <button onClick={() => setFeedbackNotice(null)} className="opacity-70 hover:opacity-100 font-bold ml-2">×</button>
        </div>
      )}

      {/* Main Grid: List (4 cols) & Detail/Editor (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Left Column: Quote List */}
        <div className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex-col gap-3 shadow-xs lg:col-span-4 ${
          mobileView === 'list' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Presupuestos ({filteredQuotes.length})
            </h3>
            <button
              onClick={() => setIsRkModalOpen(true)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> + RK
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {(['all', 'draft', 'pending_approval', 'sent'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab === 'all' ? 'Todos' : tab === 'draft' ? 'Borrador' : tab === 'pending_approval' ? 'Pendiente' : 'Enviado'}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[600px] pt-1">
            {filteredQuotes.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No hay presupuestos en esta categoría.</p>
                <button
                  onClick={() => setIsRkModalOpen(true)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-lg text-xs"
                >
                  Nuevo con Repair Knowledge
                </button>
              </div>
            ) : filteredQuotes.map(q => {
              const cust = customers.find(c => c.id === q.customerId);
              const veh = vehicles.find(v => v.id === q.vehicleId);
              const isSelected = q.id === (isEditing ? editForm?.id : activeQuote?.id);

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    if (isEditing) {
                      if (!window.confirm('Hay cambios sin guardar en el presupuesto actual. ¿Deseas descartarlos?')) {
                        return;
                      }
                      setIsEditing(false);
                      setEditForm(null);
                    }
                    setSelectedQuoteId(q.id);
                    setMobileView('detail');
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isSelected 
                      ? 'bg-blue-50/70 border-blue-400 shadow-2xs font-semibold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-500">{q.number}</span>
                    {getStatusBadge(q.status)}
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 truncate">{q.title}</h4>
                  <p className="text-xs text-slate-500">
                    {q.customerName || cust?.name || 'Cliente taller'} · {q.vehiclePlate || veh?.plate || '—'}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400 font-mono">{q.createdDate}</span>
                    <span className="text-xs font-extrabold font-mono text-slate-900">
                      {q.total !== null ? `${q.total.toFixed(2)} €` : (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">
                          Precio pendiente
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed View or Active Editor */}
        <div className="lg:col-span-8">
          {isEditing && editForm ? (
            /* ========================================================================= */
            /* 1. EDIT MODE: Modification of items, quantities, prices                   */
            /* ========================================================================= */
            <div className="bg-white border-2 border-blue-600/60 rounded-2xl p-4 sm:p-6 space-y-6 shadow-md">
              {/* Edit Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white font-mono text-xs font-bold px-2.5 py-0.5 rounded">
                      EDITANDO: {editForm.number}
                    </span>
                    {editForm.isPersistedBackendDraft && (
                      <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded">
                        Persistencia Local (Falta PATCH backend)
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 pt-1">Modificar Presupuesto y Asignar Precios</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEditing}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Título de la Intervención</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Estado del Presupuesto</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
                  >
                    <option value="draft">Borrador Taller</option>
                    <option value="pending_approval">Revisión Pendiente</option>
                    <option value="sent">Enviado por WhatsApp</option>
                    <option value="accepted">Aceptado por Cliente</option>
                  </select>
                </div>
              </div>

              {/* Items Table in Edit Mode */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Partidas de Presupuesto ({editForm.items.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddItem('part')}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Recambio
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddItem('labor')}
                      className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Mano de Obra
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                        <th className="py-2.5 px-2">Tipo</th>
                        <th className="py-2.5 px-2">Descripción</th>
                        <th className="py-2.5 px-2 text-center w-20">Cant. / h</th>
                        <th className="py-2.5 px-2 text-right w-28">Precio Unit. (€)</th>
                        <th className="py-2.5 px-2 text-right w-24">Total (€)</th>
                        <th className="py-2.5 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editForm.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-2">
                            <select
                              value={item.category}
                              onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                              className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] font-semibold"
                            >
                              <option value="part">Recambio</option>
                              <option value="labor">Mano de Obra</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-medium"
                              />
                              {item.automationStatus && (
                                <div className="flex items-center gap-1.5">
                                  {getLiteralStatusBadge(item.automationStatus)}
                                  {item.repairBomEdgeId && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Ref: {item.repairBomEdgeId}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={item.quantity ?? ''}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              placeholder="0"
                              className="w-16 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs text-center font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice ?? ''}
                              onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                              placeholder="Pendiente"
                              className={`w-24 bg-white border rounded px-1.5 py-1 text-xs text-right font-mono ${
                                item.unitPrice === null ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'
                              }`}
                            />
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                            {item.total !== null ? `${item.total.toFixed(2)} €` : (
                              <span className="text-amber-700 text-[11px]">Pendiente</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Eliminar partida"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit Totals Summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p>Mano de obra calculada: <strong className="text-slate-900 font-bold">{editForm.estimatedLaborHours} h</strong></p>
                  <p className="text-[11px] text-slate-400">Las partidas con precio pendiente no suman al total hasta ser valoradas.</p>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs text-slate-600 flex justify-between gap-8">
                    <span>Base Imponible:</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {editForm.subtotal !== null ? `${editForm.subtotal.toFixed(2)} €` : 'Pendiente'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex justify-between gap-8">
                    <span>IVA (21 %):</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {editForm.tax !== null ? `${editForm.tax.toFixed(2)} €` : 'Pendiente'}
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-blue-700 flex justify-between gap-8 pt-1 border-t border-slate-200 font-mono">
                    <span>TOTAL:</span>
                    <span>
                      {editForm.total !== null ? `${editForm.total.toFixed(2)} €` : 'Pendiente de valorar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Edit Mode */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEditing}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancelar Edición
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Presupuesto</span>
                </button>
              </div>
            </div>
          ) : activeQuote ? (
            /* ========================================================================= */
            /* 2. VIEW MODE: Professional inspection and action triggers                 */
            /* ========================================================================= */
            <div className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-6 shadow-xs ${
              mobileView === 'detail' ? 'flex flex-col' : 'hidden lg:block'
            }`}>
              
              {/* Header / Meta */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setMobileView('list')}
                      className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1 font-bold text-xs shrink-0 mr-1"
                      title="Volver a los presupuestos"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Lista</span>
                    </button>
                    
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md font-mono">
                      {activeQuote.number}
                    </span>
                    
                    {getStatusBadge(activeQuote.status)}

                    {activeQuote.isPersistedBackendDraft && (
                      <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Borrador Persistido (RK03)
                      </span>
                    )}

                    {activeQuote.hasUnsavedLocalChanges && (
                      <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Modificaciones Locales (Falta PATCH)
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">{activeQuote.title}</h3>
                  <p className="text-xs text-slate-600">
                    Cliente: <strong className="text-slate-900 font-bold">{activeQuote.customerName || customer?.name || 'Cliente de Taller'}</strong>
                    {customer?.phone && ` (${customer.phone})`} · Vehículo: <strong className="text-slate-900 font-bold">{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Vehículo Taller'}</strong>
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {(activeQuote.vehiclePlate || vehicle?.plate) && (
                    <span className="license-plate">{activeQuote.vehiclePlate || vehicle?.plate}</span>
                  )}
                </div>
              </div>

              {/* Rationale & Provenance Note */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" /> 
                    {activeQuote.isPersistedBackendDraft ? 'Borrador Técnico Oficial (Repair Knowledge):' : 'Estimación de Taller:'}
                  </span>
                  {activeQuote.applicabilityCode && (
                    <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                      {activeQuote.applicabilityCode}
                    </span>
                  )}
                </div>
                <p className="italic text-slate-600 leading-relaxed">
                  {activeQuote.aiRationale || 'Intervención configurada por taller.'}
                </p>
              </div>

              {/* Unsaved Local Changes Warning Box */}
              {activeQuote.hasUnsavedLocalChanges && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Modificaciones conservadas en almacenamiento local</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      El borrador técnico original está registrado en el backend, pero los precios asignados o líneas modificadas manualmente no están sincronizados en el servidor porque la API actual (RK03) no expone todavía el endpoint <code className="font-mono font-bold">PATCH /estimate-drafts</code>.
                    </p>
                  </div>
                </div>
              )}

              {/* Breakdown Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                      <th className="py-3 px-3">Estado / Tipo</th>
                      <th className="py-3 px-3">Descripción Recambio / Operación</th>
                      <th className="py-3 px-3 text-center">Cant. / h</th>
                      <th className="py-3 px-3 text-right">Precio Unit.</th>
                      <th className="py-3 px-3 text-right">Total</th>
                      <th className="py-3 px-3 text-center">Evidencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {activeQuote.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md inline-block ${
                              item.category === 'part' 
                                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {item.category === 'part' ? 'Recambio' : 'Mano de Obra'}
                            </span>
                            {item.automationStatus && (
                              <div>{getLiteralStatusBadge(item.automationStatus)}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-900">{item.description}</span>
                            {item.repairBomEdgeId && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                BOM Edge: {item.repairBomEdgeId}
                              </p>
                            )}
                            {item.isLocallyModified && (
                              <span className="text-[9px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded">
                                Valoración manual taller
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.quantity ?? '—'}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          {item.unitPrice === null || item.pricingStatus === 'PENDING' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                              Precio pendiente
                            </span>
                          ) : (
                            `${item.unitPrice.toFixed(2)} €`
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold font-mono text-slate-900">
                          {item.total !== null ? `${item.total.toFixed(2)} €` : (
                            <span className="text-amber-700 text-[11px] font-normal">Pendiente</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {item.evidence && item.evidence.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setEvidenceModalItem({
                                  title: item.description,
                                  itemType: item.category,
                                  repairBomEdgeId: item.repairBomEdgeId,
                                  confidenceState: item.confidenceState,
                                  automationStatus: item.automationStatus,
                                  confidenceReason: item.confidenceReason,
                                  evidence: item.evidence
                                })
                              }
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-bold underline flex items-center justify-center gap-1 mx-auto"
                              title="Inspeccionar procedencia técnica oficial"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Por qué aparece</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p>Mano de obra estimada: <strong className="text-slate-900 font-bold">{activeQuote.estimatedLaborHours} h</strong></p>
                  <p>Tarifa taller estándar: <strong className="text-slate-900 font-bold">50,00 € / hora</strong></p>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs text-slate-600 flex justify-between gap-8">
                    <span>Base Imponible:</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {activeQuote.subtotal !== null ? `${activeQuote.subtotal.toFixed(2)} €` : 'Pendiente de valoración'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex justify-between gap-8">
                    <span>IVA (21 %):</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {activeQuote.tax !== null ? `${activeQuote.tax.toFixed(2)} €` : 'Pendiente'}
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 flex justify-between gap-8 pt-1 border-t border-slate-200 font-mono">
                    <span>TOTAL:</span>
                    <span>
                      {activeQuote.total !== null ? `${activeQuote.total.toFixed(2)} €` : 'Precio pendiente'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contract Notice (Honest Technical Transparency) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Persistencia Técnica:</strong> {activeQuote.isPersistedBackendDraft
                      ? `Borrador oficial persistido en servidor (ID: ${activeQuote.backendDraftId?.slice(0, 10)}...).`
                      : 'Borrador almacenado localmente en navegador.'}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shrink-0">
                  Bloqueo backend: Falta PATCH /v1/workshop/tenants/:tenantId/estimate-drafts/:draftId
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <button
                  onClick={handleDeleteActiveQuote}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button 
                    onClick={handleStartEditing}
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span>Editar Presupuesto / Asignar Precios</span>
                  </button>

                  {activeQuote.status === 'pending_approval' || activeQuote.status === 'draft' ? (
                    <button
                      onClick={() => {
                        approveQuote(activeQuote.id);
                        setFeedbackNotice({
                          type: 'success',
                          text: `Presupuesto ${activeQuote.number} aprobado y enviado por WhatsApp.`
                        });
                      }}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all min-h-[44px]"
                    >
                      <Check className="w-4 h-4 text-white" />
                      <span>Aprobar y Enviar por WhatsApp</span>
                    </button>
                  ) : (
                    <span className="w-full sm:w-auto bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 min-h-[44px]">
                      <Check className="w-4 h-4 text-emerald-600" /> Enviado por WhatsApp
                    </span>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs shadow-xs flex flex-col items-center justify-center gap-3">
              <FileText className="w-10 h-10 text-slate-300" />
              <div className="space-y-1">
                <p className="font-bold text-slate-800 text-sm">Sin presupuesto seleccionado</p>
                <p className="max-w-xs mx-auto">Consulta Repair Knowledge para generar un borrador oficial o crea un borrador manual.</p>
              </div>
              <button
                onClick={() => setIsRkModalOpen(true)}
                className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>+ Crear con Repair Knowledge</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Repair Knowledge Modal (Step flow 1: Query -> 2: Preview -> 3: Create Draft) */}
      <RepairKnowledgeFlowModal
        isOpen={isRkModalOpen}
        onClose={() => setIsRkModalOpen(false)}
        tenantId={tenantId}
        vehicles={vehicles}
        customers={customers}
        onDraftCreated={handleDraftCreatedFromRK}
        onInspectEvidence={(item) => setEvidenceModalItem(item)}
      />

      {/* Evidence & Provenance Modal */}
      <RepairEvidenceModal
        isOpen={Boolean(evidenceModalItem)}
        onClose={() => setEvidenceModalItem(null)}
        item={evidenceModalItem}
      />

    </div>
  );
};
