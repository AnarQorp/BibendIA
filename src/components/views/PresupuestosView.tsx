import React, { useState, useEffect, useMemo } from 'react';
import { useDemo } from '../../context/DemoContext';
import type { 
  Quote, 
  QuoteItem, 
  EstimateAutomationStatus, 
  RepairEvidence,
  EstimateDraft
} from '../../types';
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
  CheckCircle2,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';
import { RepairKnowledgeFlowModal } from './RepairKnowledgeFlowModal';
import { RepairEvidenceModal } from './RepairEvidenceModal';
import { ManualEstimateModal } from './ManualEstimateModal';
import { ManualCustomerModal } from './ManualCustomerModal';
import { ManualVehicleModal } from './ManualVehicleModal';
import { 
  fetchEstimateDrafts,
  fetchEstimateDraftById,
  patchEstimateDraft,
  buildEstimateDraftEditCommand,
  convertEstimateDraftToQuote
} from '../../services/repairKnowledge';
import { loadHumanSession } from '../../services/humanSession';
import { getWorkshopTenantId } from '../../services/workshopAppointments';
import { useRouter } from '../../router/RouterContext';
import {
  formatAutomationStatus,
  formatPartName,
  formatQuoteStatus,
  formatUnitPrice,
  formatLineTotal
} from '../../utils/workshopFormatters';

export const PresupuestosView: React.FC = () => {
  const {
    quotes,
    customers,
    vehicles,
    approveQuote,
    updateQuote,
    addQuote,
    deleteQuote,
    generateQuoteFromPrompt,
    demoModeActive
  } = useDemo();

  // Tenant ID resolution for workshop operations:
  // Prop -> getWorkshopTenantId() -> session -> URL -> localStorage
  const [tenantId, setTenantId] = useState<string>(() => {
    const resolved = getWorkshopTenantId();
    if (resolved) return resolved;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bibendia_tenant_id');
      if (stored) return stored;
    }
    return '';
  });

  useEffect(() => {
    let isMounted = true;
    async function resolveSession() {
      if (tenantId) return;
      try {
        const session = await loadHumanSession();
        if (!isMounted) return;
        if (session?.tenantIds && session.tenantIds.length > 0) {
          setTenantId(session.tenantIds[0]);
        }
      } catch {
        // Fall back gracefully
      }
    }
    resolveSession();
    return () => { isMounted = false; };
  }, [tenantId]);

  // PostgreSQL persisted drafts state (RK04)
  const [postgresQuotes, setPostgresQuotes] = useState<Quote[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState<boolean>(false);
  const [deletedManualLineIds, setDeletedManualLineIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load real drafts from PostgreSQL when tenantId is available
  const loadPostgresDrafts = async (tId: string) => {
    if (!tId) return;
    setLoadingDrafts(true);
    const res = await fetchEstimateDrafts(tId);
    if (res.status === 'success' && res.data && res.data.length > 0) {
      const fullDrafts = await Promise.all(
        res.data.map(d => fetchEstimateDraftById(tId, d.id))
      );
      const converted = fullDrafts
        .filter(r => r.status === 'success' && r.data)
        .map(r => convertEstimateDraftToQuote(r.data!));
      if (converted.length > 0) {
        setPostgresQuotes(converted);
        setSelectedQuoteId(current => {
          if (current && converted.some(q => q.id === current)) return current;
          return converted[0].id;
        });
      }
    }
    setLoadingDrafts(false);
  };

  useEffect(() => {
    if (tenantId) {
      loadPostgresDrafts(tenantId);
    }
  }, [tenantId]);

  // Combine PostgreSQL drafts (top priority) with any demo quotes without duplicates
  const allQuotes = useMemo(() => {
    const combined: Quote[] = [...postgresQuotes];
    for (const q of quotes) {
      if (!combined.some(c => c.id === q.id || (c.backendDraftId && c.backendDraftId === q.backendDraftId))) {
        combined.push(q);
      }
    }
    return combined;
  }, [postgresQuotes, quotes]);

  const [promptInput, setPromptInput] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(() => allQuotes[0]?.id || '');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'pending_approval' | 'sent'>('all');

  // Modals and Contextual Navigation
  const { searchParams } = useRouter();
  const [isRkModalOpen, setIsRkModalOpen] = useState(false);
  const [initialRkVehicleId, setInitialRkVehicleId] = useState<string | undefined>(undefined);
  const [initialRkPlate, setInitialRkPlate] = useState<string | undefined>(undefined);

  // Manual Operations Foundation Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [manualModalParams, setManualModalParams] = useState<{
    title?: string;
    plate?: string;
    make?: string;
    model?: string;
    vehicleId?: string;
    customerName?: string;
    customerPhone?: string;
    customerId?: string;
    appointmentId?: string;
  }>({});

  useEffect(() => {
    if (searchParams.get('new') === 'rk') {
      const vId = searchParams.get('vehicleId');
      const plate = searchParams.get('plate');
      if (vId) setInitialRkVehicleId(vId);
      if (plate) setInitialRkPlate(plate);
      setIsRkModalOpen(true);
    } else if (searchParams.get('new') === 'manual') {
      setManualModalParams({
        title: searchParams.get('reason') || searchParams.get('title') || undefined,
        plate: searchParams.get('plate') || undefined,
        make: searchParams.get('make') || undefined,
        model: searchParams.get('model') || undefined,
        vehicleId: searchParams.get('vehicleId') || undefined,
        customerName: searchParams.get('customerName') || undefined,
        customerPhone: searchParams.get('customerPhone') || undefined,
        customerId: searchParams.get('customerId') || undefined,
        appointmentId: searchParams.get('appointmentId') || undefined,
      });
      setIsManualModalOpen(true);
    }
  }, [searchParams]);
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
    knowledgeRevision?: string | null;
    version?: number | null;
    applicabilityCode?: string | null;
  } | null>(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Quote | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Sync selectedQuoteId if quotes change
  useEffect(() => {
    if (!selectedQuoteId && allQuotes.length > 0) {
      setSelectedQuoteId(allQuotes[0].id);
    }
  }, [allQuotes, selectedQuoteId]);

  const activeQuote = allQuotes.find(q => q.id === selectedQuoteId) || allQuotes[0];
  const customer = customers.find(c => c.id === activeQuote?.customerId);
  const vehicle = vehicles.find(v => v.id === activeQuote?.vehicleId);

  const filteredQuotes = allQuotes.filter(q => {
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

  const handleOpenManualModal = (params?: typeof manualModalParams) => {
    if (tenantId) {
      if (params) setManualModalParams(params);
      else setManualModalParams({});
      setIsManualModalOpen(true);
    } else {
      handleStartNewQuote();
    }
  };

  const handleManualDraftCreated = (draft: EstimateDraft) => {
    const quote = convertEstimateDraftToQuote(
      draft,
      draft.customerSnapshot?.name || 'Cliente Taller',
      draft.vehicleSnapshot?.plate || '—'
    );
    setPostgresQuotes(prev => [quote, ...prev.filter(q => q.id !== quote.id)]);
    addQuote(quote);
    setSelectedQuoteId(quote.id);
    setMobileView('detail');
    setIsEditing(true);
    setEditForm(JSON.parse(JSON.stringify(quote)));
    setFeedbackNotice({
      type: 'success',
      text: `Presupuesto manual ${quote.number} creado y guardado en taller. Ya puedes detallar recambios o mano de obra.`
    });
  };

  const handleStartNewQuote = () => {
    const newId = `q-${Date.now()}`;
    const nextNumber = `PRE-2026-${String(allQuotes.length + 1).padStart(3, '0')}`;
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

  const handleStartManualQuoteFromContext = (context?: { plate?: string; vin?: string; make?: string; model?: string }) => {
    if (tenantId) {
      handleOpenManualModal({
        plate: context?.plate,
        make: context?.make,
        model: context?.model,
      });
      return;
    }
    const newId = `q-${Date.now()}`;
    const nextNumber = `PRE-2026-${String(allQuotes.length + 1).padStart(3, '0')}`;
    const vehicleTitle = context?.make && context?.model ? `${context.make} ${context.model}` : 'Vehículo';
    const foundVehicle = context?.plate
      ? vehicles.find(v => v.plate.toUpperCase() === context.plate?.toUpperCase())
      : undefined;
    const foundCustomer = foundVehicle
      ? customers.find(c => c.id === (foundVehicle as any).customerId)
      : undefined;

    const blankQuote: Quote = {
      id: newId,
      number: nextNumber,
      customerId: foundCustomer?.id || '',
      vehicleId: foundVehicle?.id || '',
      customerName: foundCustomer?.name || 'Cliente Taller',
      vehiclePlate: context?.plate || foundVehicle?.plate || '0000-XXX',
      title: `Intervención · ${vehicleTitle}`,
      createdDate: 'Hoy',
      status: 'draft',
      items: [
        {
          id: `item-${Date.now()}-1`,
          category: 'part',
          description: 'Recambio principal',
          quantity: 1,
          unitPrice: null,
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
      aiRationale: `Borrador manual para ${vehicleTitle}. Operaciones y partidas configurables por el taller.`,
      isPersistedBackendDraft: false,
      hasUnsavedLocalChanges: false
    };
    addQuote(blankQuote);
    setSelectedQuoteId(newId);
    setEditForm(JSON.parse(JSON.stringify(blankQuote)));
    setIsEditing(true);
    setMobileView('detail');
    setFeedbackNotice({
      type: 'success',
      text: `Presupuesto manual ${nextNumber} iniciado para ${vehicleTitle}. Datos del vehículo conservados.`
    });
  };

  const handleStartEditing = () => {
    if (!activeQuote) return;
    const cloned = JSON.parse(JSON.stringify(activeQuote));
    // Translate item descriptions to natural workshop terms for any RK lines
    cloned.items = cloned.items.map((item: QuoteItem) => {
      const naturalName = formatPartName({
        partRoleCode: item.partRoleCode,
        partRoleName: item.partRoleName,
        description: item.description,
        edgeCode: item.repairBomEdgeId
      });
      return {
        ...item,
        description: naturalName
      };
    });
    setEditForm(cloned);
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
    const mutationKey = `man-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newItem: QuoteItem = {
      id: mutationKey,
      mutationKey,
      category,
      description: category === 'part' ? 'Nuevo recambio / material' : 'Operación de mano de obra',
      quantity: 1,
      unitPrice: null, // Pending by default
      total: null,
      pricingStatus: 'PENDING',
      lineSource: 'MANUAL_WORKSHOP',
      pricingProvenance: 'MANUAL_WORKSHOP',
      selected: true,
      isLocallyModified: true
    };
    const newItems = [...editForm.items, newItem];
    const pricedItems = newItems.filter(item => item.selected !== false && item.unitPrice !== null && item.quantity !== null && item.pricingStatus !== 'PENDING');
    const hasPending = newItems.some(item => item.selected !== false && (item.unitPrice === null || item.pricingStatus === 'PENDING'));

    let subtotal: number | null = null;
    let tax: number | null = null;
    let total: number | null = null;

    if (pricedItems.length > 0 && !hasPending) {
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
    const target = editForm.items[index];
    if (!target) return;

    // Rule: una línea de RK nunca se elimina físicamente: se marca selected=false.
    if (target.lineSource === 'REPAIR_KNOWLEDGE' || target.repairBomEdgeId) {
      const newItems = [...editForm.items];
      newItems[index] = {
        ...target,
        selected: false,
        isLocallyModified: true
      };
      
      const pricedItems = newItems.filter(item => item.selected !== false && item.unitPrice !== null && item.quantity !== null && item.pricingStatus !== 'PENDING');
      const hasPending = newItems.some(item => item.selected !== false && (item.unitPrice === null || item.pricingStatus === 'PENDING'));

      let subtotal: number | null = null;
      let tax: number | null = null;
      let total: number | null = null;

      if (pricedItems.length > 0 && !hasPending) {
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
      setFeedbackNotice({
        type: 'warning',
        text: `Partida OEM "${target.description}" desmarcada del presupuesto. Por trazabilidad oficial, las líneas de Repair Knowledge no se destruyen físicamente.`
      });
      return;
    }

    // Rule: deleteLineIds solo se usa para líneas manuales de taller (lineSource === 'MANUAL_WORKSHOP')
    if (target.lineSource === 'MANUAL_WORKSHOP' && target.id && !target.mutationKey) {
      setDeletedManualLineIds(prev => [...prev, target.id]);
    }

    const newItems = editForm.items.filter((_, i) => i !== index);
    const pricedItems = newItems.filter(item => item.selected !== false && item.unitPrice !== null && item.quantity !== null && item.pricingStatus !== 'PENDING');
    const hasPending = newItems.some(item => item.selected !== false && (item.unitPrice === null || item.pricingStatus === 'PENDING'));

    let subtotal: number | null = null;
    let tax: number | null = null;
    let total: number | null = null;

    if (pricedItems.length > 0 && !hasPending) {
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

  const handleToggleSelect = (index: number) => {
    if (!editForm) return;
    const target = editForm.items[index];
    if (!target) return;
    const newItems = [...editForm.items];
    newItems[index] = {
      ...target,
      selected: target.selected === false ? true : false,
      isLocallyModified: true
    };

    const pricedItems = newItems.filter(item => item.selected !== false && item.unitPrice !== null && item.quantity !== null && item.pricingStatus !== 'PENDING');
    const hasPending = newItems.some(item => item.selected !== false && (item.unitPrice === null || item.pricingStatus === 'PENDING'));

    let subtotal: number | null = null;
    let tax: number | null = null;
    let total: number | null = null;

    if (pricedItems.length > 0 && !hasPending) {
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

    // Check if quote was a persistent backend draft in PostgreSQL (RK04)
    if (editForm.isPersistedBackendDraft && editForm.backendDraftId) {
      const expectedVersion = editForm.version ?? 1;
      const idempotencyKey = `save-${editForm.backendDraftId}-v${expectedVersion}-${Date.now()}`;

      const command = buildEstimateDraftEditCommand(editForm, idempotencyKey, deletedManualLineIds);
      const hasChanges = (command.lines && command.lines.length > 0) ||
                         (command.deleteLineIds && command.deleteLineIds.length > 0) ||
                         command.status !== undefined;

      if (!hasChanges) {
        setIsEditing(false);
        setEditForm(null);
        setDeletedManualLineIds([]);
        setFeedbackNotice({
          type: 'success',
          text: `Presupuesto ${editForm.number} sin modificaciones pendientes.`
        });
        return;
      }

      setIsSaving(true);
      const result = await patchEstimateDraft(tenantId, editForm.backendDraftId, command);
      setIsSaving(false);

      if (result.status === 'success' && result.data) {
        const updatedQuote = convertEstimateDraftToQuote(
          result.data,
          editForm.customerName || 'Cliente Taller',
          editForm.vehiclePlate || '7731 CKB'
        );
        setPostgresQuotes(prev => prev.map(q => q.id === updatedQuote.id ? updatedQuote : q));
        updateQuote(updatedQuote);
        setIsEditing(false);
        setEditForm(null);
        setDeletedManualLineIds([]);
        setFeedbackNotice({
          type: 'success',
          text: `Presupuesto ${updatedQuote.number} guardado correctamente. Cambios sincronizados.`
        });
        return;
      }

      if (result.status === 'conflict') {
        if (result.errorCode === 'ESTIMATE_VERSION_CONFLICT') {
          // Rule: si el backend responde 409 ESTIMATE_VERSION_CONFLICT, recarga y pide reintentar, nunca sobrescribas a ciegas.
          const fresh = await fetchEstimateDraftById(tenantId, editForm.backendDraftId);
          if (fresh.status === 'success' && fresh.data) {
            const reloadedQuote = convertEstimateDraftToQuote(
              fresh.data,
              editForm.customerName || 'Cliente Taller',
              editForm.vehiclePlate || '7731 CKB'
            );
            setPostgresQuotes(prev => prev.map(q => q.id === reloadedQuote.id ? reloadedQuote : q));
            setEditForm(JSON.parse(JSON.stringify(reloadedQuote)));
            setFeedbackNotice({
              type: 'error',
              text: `Conflicto de concurrencia: Otro usuario o proceso actualizó este presupuesto. Se han recargado los datos más recientes. Por favor, revisa y vuelve a guardar.`
            });
            return;
          }
        }
        setFeedbackNotice({
          type: 'error',
          text: result.message || 'Conflicto de concurrencia al guardar el presupuesto.'
        });
        return;
      }

      setFeedbackNotice({
        type: 'error',
        text: result.message || 'Error al guardar modificaciones en el servidor.'
      });
      return;
    }

    // Pure local demo fallback
    updateQuote(editForm);
    setIsEditing(false);
    setEditForm(null);
    setFeedbackNotice({
      type: 'success',
      text: `Presupuesto ${editForm.number} guardado correctamente.`
    });
  };

  const handleDeleteActiveQuote = () => {
    if (!activeQuote) return;
    if (window.confirm(`¿Seguro que deseas eliminar el presupuesto ${activeQuote.number}?`)) {
      deleteQuote(activeQuote.id);
      setPostgresQuotes(prev => prev.filter(q => q.id !== activeQuote.id));
      setSelectedQuoteId(allQuotes[0]?.id || '');
      setIsEditing(false);
      setEditForm(null);
      setFeedbackNotice({ type: 'success', text: `Presupuesto ${activeQuote.number} eliminado.` });
    }
  };

  const handleDraftCreatedFromRK = (newQuote: Quote) => {
    setPostgresQuotes(prev => [newQuote, ...prev.filter(q => q.id !== newQuote.id)]);
    addQuote(newQuote);
    setSelectedQuoteId(newQuote.id);
    setMobileView('detail');
    setFeedbackNotice({
      type: 'success',
      text: `Presupuesto ${newQuote.number} preparado con las partidas recomendadas. Ya puedes asignar precios y mano de obra.`
    });
  };

  const getStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300">
            Borrador
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
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
            <Check className="w-3 h-3 text-blue-600" /> Enviado por WhatsApp
          </span>
        );
      case 'accepted':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
            Aceptado por Cliente
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
            {formatQuoteStatus(status)}
          </span>
        );
    }
  };

  const getLiteralStatusBadge = (status?: EstimateAutomationStatus) => {
    if (!status) return null;
    const p = formatAutomationStatus(status);
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${p.badgeClass}`}>
        {p.label}
      </span>
    );
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
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded">
                  Conocimiento Técnico Activo
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Consulta de intervenciones recomendadas, partidas necesarias y creación directa de presupuestos.
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
              <span>+ Nuevo Presupuesto Técnico</span>
            </button>

            {/* Secondary Manual Draft Button */}
            <button
              onClick={() => handleOpenManualModal()}
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
              <Sparkles className="w-3.5 h-3.5" /> + Nuevo
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
                      <span className="text-[10px] font-medium bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-blue-600" /> Guardado en taller
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
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
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
                      {editForm.items.map((item, idx) => {
                        const isDeselected = item.selected === false;
                        const isRkLine = item.lineSource === 'REPAIR_KNOWLEDGE' || !!item.repairBomEdgeId;

                        return (
                          <tr key={item.id || item.mutationKey || idx} className={`hover:bg-slate-50 ${isDeselected ? 'opacity-50 bg-slate-100/50' : ''}`}>
                            <td className="py-2.5 px-2">
                              <div className="flex flex-col gap-1">
                                <select
                                  value={item.category}
                                  disabled={isDeselected}
                                  onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                                  className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] font-semibold"
                                >
                                  <option value="part">Recambio</option>
                                  <option value="labor">Mano de Obra</option>
                                </select>
                                {item.lineSource === 'MANUAL_WORKSHOP' && (
                                  <span className="text-[9px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded w-max">
                                    Manual
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={item.description}
                                  disabled={isDeselected}
                                  onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                  className={`w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-medium ${isDeselected ? 'line-through text-slate-400' : ''}`}
                                />
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {item.automationStatus && (
                                    <div>{getLiteralStatusBadge(item.automationStatus)}</div>
                                  )}
                                  {isDeselected && (
                                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold font-mono">
                                      Desmarcada (No incluida)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                disabled={isDeselected}
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
                                disabled={isDeselected}
                                value={item.unitPrice ?? ''}
                                onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                placeholder="Pendiente"
                                className={`w-24 bg-white border rounded px-1.5 py-1 text-xs text-right font-mono ${
                                  item.unitPrice === null ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'
                                }`}
                              />
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                              {!isDeselected && item.total !== null ? `${item.total.toFixed(2)} €` : (
                                <span className="text-amber-700 text-[11px]">{isDeselected ? '—' : 'Pendiente'}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {isDeselected ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleSelect(idx)}
                                  className="p-1 text-blue-600 hover:text-blue-800 rounded transition"
                                  title="Reactivar partida en presupuesto"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : isRkLine ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 text-amber-600 hover:text-amber-800 rounded transition"
                                  title="Desmarcar partida OEM (No incluida)"
                                >
                                  <EyeOff className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                  title="Eliminar partida manual"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
                      <span className="text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Guardado
                      </span>
                    )}

                    {activeQuote.backendDraft?.draftType === 'MANUAL_WORKSHOP' && (
                      <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-purple-600" /> Presupuesto Manual
                      </span>
                    )}

                    {activeQuote.hasUnsavedLocalChanges && !activeQuote.isPersistedBackendDraft && (
                      <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Modificaciones Locales
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
                    {activeQuote.isPersistedBackendDraft ? 'Propuesta técnica recomendada:' : 'Estimación de Taller:'}
                  </span>
                  {activeQuote.applicabilityCode && (
                    <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      Aplicabilidad verificada
                    </span>
                  )}
                </div>
                <p className="italic text-slate-600 leading-relaxed">
                  {activeQuote.aiRationale || 'Intervención configurada por taller.'}
                </p>
              </div>

              {/* Unsaved Local Changes Warning Box */}
              {activeQuote.hasUnsavedLocalChanges && !activeQuote.isPersistedBackendDraft && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Modificaciones pendientes de sincronización</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      El borrador técnico original está guardado, pero las modificaciones realizadas manualmente en las líneas aún no se han sincronizado.
                    </p>
                  </div>
                </div>
              )}

              {/* Unpersisted Customer / Vehicle Snapshot Banner */}
              {(!activeQuote.customerId || !activeQuote.vehicleId) && (activeQuote.backendDraft?.customerSnapshot || activeQuote.backendDraft?.vehicleSnapshot) && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Ficha de cliente o vehículo pendiente de consolidar</p>
                      <p className="text-[11px] text-blue-700">
                        Este presupuesto se creó con datos libres. Puedes guardar una ficha fija en el taller para reutilizarla en futuras citas o presupuestos.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!activeQuote.customerId && (
                      <button
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-100/60 font-bold rounded-lg text-2xs transition"
                      >
                        Guardar Cliente en Ficha
                      </button>
                    )}
                    {!activeQuote.vehicleId && (
                      <button
                        type="button"
                        onClick={() => setIsVehicleModalOpen(true)}
                        className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-lg text-2xs transition shadow-2xs"
                      >
                        Guardar Vehículo en Ficha
                      </button>
                    )}
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
                    {activeQuote.items.map((item, idx) => {
                      const isDeselected = item.selected === false;
                      return (
                        <tr key={item.id || item.mutationKey || idx} className={isDeselected ? "opacity-60 bg-slate-50/50" : "hover:bg-slate-50/60"}>
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
                              {isDeselected && (
                                <div>
                                  <span className="text-[9px] font-mono bg-slate-200 text-slate-700 border border-slate-300 px-1 py-0.5 rounded inline-block">
                                    Desmarcada (Excluida)
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <span className={`font-semibold ${isDeselected ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                {formatPartName(item.description, item.partRoleCode || item.edgeCode, item.category)}
                              </span>
                              {item.lineSource === 'MANUAL_WORKSHOP' && (
                                <div>
                                  <span className="text-[9px] font-mono bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded inline-block">
                                    Línea manual taller
                                  </span>
                                </div>
                              )}
                              {item.isLocallyModified && item.lineSource !== 'MANUAL_WORKSHOP' && (
                                <div>
                                  <span className="text-[9px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded inline-block">
                                    Valoración manual taller
                                  </span>
                                </div>
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
                            {isDeselected ? (
                              <span className="text-slate-400 text-[11px] font-normal italic">Excluida</span>
                            ) : item.total !== null ? (
                              `${item.total.toFixed(2)} €`
                            ) : (
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
                                    repairBomEdgeId: item.repairBomEdgeId ?? undefined,
                                    confidenceState: item.confidenceState,
                                    automationStatus: item.automationStatus,
                                    confidenceReason: item.confidenceReason,
                                    evidence: item.evidence,
                                    applicabilityCode: activeQuote.applicabilityCode,
                                    knowledgeRevision: activeQuote.knowledgeRevision,
                                    version: activeQuote.version
                                  })
                                }
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold underline flex items-center justify-center gap-1 mx-auto"
                                title="Inspeccionar procedencia técnica"
                              >
                                <Info className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Por qué se recomienda</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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

              {/* Workshop Persistence Status Notice */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {activeQuote.isPersistedBackendDraft
                      ? 'Presupuesto guardado y sincronizado con el taller.'
                      : 'Presupuesto en preparación local.'}
                  </span>
                </div>
                {activeQuote.number && (
                  <span className="font-mono text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded shrink-0">
                    Ref: {activeQuote.number}
                  </span>
                )}
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
                    demoModeActive ? (
                      <button
                        onClick={() => {
                          approveQuote(activeQuote.id);
                          setFeedbackNotice({
                            type: 'success',
                            text: `Presupuesto ${activeQuote.number} aprobado y enviado por WhatsApp (simulación demo).`
                          });
                        }}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all min-h-[44px]"
                      >
                        <Check className="w-4 h-4 text-white" />
                        <span>Aprobar y Enviar por WhatsApp</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="El canal de envío directo por WhatsApp para presupuestos se encuentra en preparación técnica."
                        className="w-full sm:w-auto bg-slate-100 border border-slate-300 text-slate-400 font-bold px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-80 min-h-[44px]"
                      >
                        <Check className="w-4 h-4 text-slate-400" />
                        <span>Aprobar y Enviar por WhatsApp (Canal en preparación)</span>
                      </button>
                    )
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
        onClose={() => {
          setIsRkModalOpen(false);
          setInitialRkVehicleId(undefined);
          setInitialRkPlate(undefined);
        }}
        tenantId={tenantId}
        vehicles={vehicles}
        customers={customers}
        initialVehicleId={initialRkVehicleId}
        initialPlate={initialRkPlate}
        onDraftCreated={handleDraftCreatedFromRK}
        onInspectEvidence={(item) => setEvidenceModalItem(item)}
        onContinueManual={handleStartManualQuoteFromContext}
      />

      {/* Evidence & Provenance Modal */}
      <RepairEvidenceModal
        isOpen={Boolean(evidenceModalItem)}
        onClose={() => setEvidenceModalItem(null)}
        item={evidenceModalItem}
      />

      {/* Manual Estimate Creation Modal */}
      <ManualEstimateModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setManualModalParams({});
        }}
        tenantId={tenantId}
        onDraftCreated={handleManualDraftCreated}
        initialTitle={manualModalParams.title}
        initialVehiclePlate={manualModalParams.plate}
        initialVehicleMake={manualModalParams.make}
        initialVehicleModel={manualModalParams.model}
        initialVehicleId={manualModalParams.vehicleId}
        initialCustomerName={manualModalParams.customerName}
        initialCustomerPhone={manualModalParams.customerPhone}
        initialCustomerId={manualModalParams.customerId}
        initialAppointmentId={manualModalParams.appointmentId}
      />

      {/* Manual Customer Registration Modal */}
      <ManualCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        tenantId={tenantId}
        initialName={activeQuote?.backendDraft?.customerSnapshot?.name || activeQuote?.customerName || ''}
        initialPhone={activeQuote?.backendDraft?.customerSnapshot?.phone || ''}
        initialEmail={activeQuote?.backendDraft?.customerSnapshot?.email || ''}
        onCustomerCreated={(newCust) => {
          setFeedbackNotice({
            type: 'success',
            text: `Cliente ${newCust.name} guardado con éxito en el registro de taller.`
          });
        }}
      />

      {/* Manual Vehicle Registration Modal */}
      <ManualVehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        tenantId={tenantId}
        initialPlate={activeQuote?.backendDraft?.vehicleSnapshot?.plate || activeQuote?.vehiclePlate || ''}
        initialMake={activeQuote?.backendDraft?.vehicleSnapshot?.make || ''}
        initialModel={activeQuote?.backendDraft?.vehicleSnapshot?.model || ''}
        initialYear={activeQuote?.backendDraft?.vehicleSnapshot?.year}
        initialVin={activeQuote?.backendDraft?.vehicleSnapshot?.vin || ''}
        initialCustomerId={activeQuote?.customerId || undefined}
        onVehicleCreated={(newVeh) => {
          setFeedbackNotice({
            type: 'success',
            text: `Vehículo ${newVeh.plate || newVeh.vin || `${newVeh.make || ''} ${newVeh.model || ''}`.trim()} registrado con éxito en taller.`
          });
        }}
      />

    </div>
  );
};
