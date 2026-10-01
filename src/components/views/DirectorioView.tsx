import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from '../../router/RouterContext';
import {
  Users,
  Car,
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  X,
  Edit2,
  Link as LinkIcon,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
  Wrench,
  ShieldCheck,
} from 'lucide-react';
import type {
  WorkshopCustomer,
  WorkshopVehicle,
  CustomerDetailResponse,
  VehicleDetailResponse,
  WorkshopAppointmentSummary,
  WorkshopEstimateSummary,
} from '../../types';
import {
  listWorkshopCustomers,
  listWorkshopVehicles,
  getWorkshopCustomerDetail,
  updateWorkshopCustomer,
  getWorkshopVehicleDetail,
  updateWorkshopVehicle,
  associateCustomerVehicle,
} from '../../services/workshopOperations';
import { ManualCustomerModal } from './ManualCustomerModal';
import { ManualVehicleModal } from './ManualVehicleModal';

export const SpanishPlateBadge: React.FC<{ plate?: string | null; className?: string }> = ({ plate, className = '' }) => {
  if (!plate) {
    return <span className={`text-slate-400 font-mono text-xs italic ${className}`}>Sin matrícula</span>;
  }
  return (
    <div className={`inline-flex items-stretch bg-white border border-slate-300 rounded shadow-2xs font-mono font-black text-xs overflow-hidden select-none shrink-0 ${className}`}>
      <div className="bg-[#003399] text-white px-1.5 py-0.5 text-[9px] font-bold flex flex-col items-center justify-center leading-none">
        <span className="text-[7px] text-amber-300 leading-none">★</span>
        <span className="font-extrabold tracking-tighter text-[9px]">E</span>
      </div>
      <div className="px-2 py-0.5 text-slate-900 tracking-wider font-extrabold uppercase flex items-center">
        {plate}
      </div>
    </div>
  );
};

export interface DirectorioViewProps {
  tenantId: string;
}

export const DirectorioView: React.FC<DirectorioViewProps> = ({ tenantId }) => {
  const { searchParams, navigate } = useRouter();

  // Active Tab
  const initialTab = searchParams.get('tab') === 'vehiculos' ? 'vehiculos' : 'clientes';
  const [activeTab, setActiveTab] = useState<'clientes' | 'vehiculos'>(initialTab);

  // Search State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Directory Data
  const [customers, setCustomers] = useState<WorkshopCustomer[]>([]);
  const [vehicles, setVehicles] = useState<WorkshopVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals for creation
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [initialVehicleCustomerId, setInitialVehicleCustomerId] = useState<string | undefined>(undefined);

  // Detail Ficha State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(searchParams.get('customer') || null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(searchParams.get('vehicle') || null);

  const [customerDetail, setCustomerDetail] = useState<CustomerDetailResponse | null>(null);
  const [vehicleDetail, setVehicleDetail] = useState<VehicleDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Quote Option Modal
  const [quoteVehicleOption, setQuoteVehicleOption] = useState<WorkshopVehicle | null>(null);

  // Association Modal
  const [isAssociatingVehicle, setIsAssociatingVehicle] = useState(false);
  const [associationSelectedVehicleId, setAssociationSelectedVehicleId] = useState('');
  const [isAssociatingCustomer, setIsAssociatingCustomer] = useState(false);
  const [associationSelectedCustomerId, setAssociationSelectedCustomerId] = useState('');

  // Auto-dismiss notice
  useEffect(() => {
    if (feedbackNotice) {
      const timer = setTimeout(() => setFeedbackNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackNotice]);

  // Load Customers and Vehicles
  const loadDirectoryData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [custRes, vehRes] = await Promise.all([
        listWorkshopCustomers(tenantId, { search: searchQuery.trim() || undefined, limit: 100 }),
        listWorkshopVehicles(tenantId, { search: searchQuery.trim() || undefined, limit: 100 }),
      ]);

      if (custRes.status === 'success' && custRes.data) {
        setCustomers(custRes.data);
      } else if (custRes.status === 'unauthorized') {
        setErrorMessage('Sesión no autorizada para consultar el directorio.');
      }

      if (vehRes.status === 'success' && vehRes.data) {
        setVehicles(vehRes.data);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al cargar los datos del taller.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, searchQuery]);

  useEffect(() => {
    loadDirectoryData();
  }, [loadDirectoryData]);

  // Load Customer Detail Ficha
  const loadCustomerDetail = useCallback(async (id: string) => {
    if (!tenantId || !id) return;
    setIsDetailLoading(true);
    try {
      const res = await getWorkshopCustomerDetail(tenantId, id);
      if (res.status === 'success' && res.data) {
        setCustomerDetail(res.data);
      } else {
        setFeedbackNotice({ type: 'error', text: res.message || 'Error al abrir la ficha de cliente.' });
      }
    } catch {
      setFeedbackNotice({ type: 'error', text: 'Error de red al cargar la ficha.' });
    } finally {
      setIsDetailLoading(false);
    }
  }, [tenantId]);

  // Load Vehicle Detail Ficha
  const loadVehicleDetail = useCallback(async (id: string) => {
    if (!tenantId || !id) return;
    setIsDetailLoading(true);
    try {
      const res = await getWorkshopVehicleDetail(tenantId, id);
      if (res.status === 'success' && res.data) {
        setVehicleDetail(res.data);
      } else {
        setFeedbackNotice({ type: 'error', text: res.message || 'Error al abrir la ficha de vehículo.' });
      }
    } catch {
      setFeedbackNotice({ type: 'error', text: 'Error de red al cargar la ficha.' });
    } finally {
      setIsDetailLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerDetail(selectedCustomerId);
    } else {
      setCustomerDetail(null);
    }
  }, [selectedCustomerId, loadCustomerDetail]);

  useEffect(() => {
    if (selectedVehicleId) {
      loadVehicleDetail(selectedVehicleId);
    } else {
      setVehicleDetail(null);
    }
  }, [selectedVehicleId, loadVehicleDetail]);

  // Filtered in-memory views if search query applied
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.vehicles && c.vehicles.some(v => (v.plate && v.plate.toLowerCase().includes(q)) || (v.make && v.make.toLowerCase().includes(q))))
    );
  }, [customers, searchQuery]);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles;
    const q = searchQuery.toLowerCase().trim();
    return vehicles.filter(v =>
      (v.plate && v.plate.toLowerCase().includes(q)) ||
      (v.make && v.make.toLowerCase().includes(q)) ||
      (v.model && v.model.toLowerCase().includes(q)) ||
      (v.vin && v.vin.toLowerCase().includes(q)) ||
      (v.customer && v.customer.name.toLowerCase().includes(q))
    );
  }, [vehicles, searchQuery]);

  // Customer Inline Edit State
  const [custEditName, setCustEditName] = useState('');
  const [custEditPhone, setCustEditPhone] = useState('');
  const [custEditEmail, setCustEditEmail] = useState('');
  const [custEditNotes, setCustEditNotes] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [custDuplicateNotice, setCustDuplicateNotice] = useState<WorkshopCustomer | null>(null);

  useEffect(() => {
    if (customerDetail?.customer) {
      setCustEditName(customerDetail.customer.name || '');
      setCustEditPhone(customerDetail.customer.phone || '');
      setCustEditEmail(customerDetail.customer.email || '');
      setCustEditNotes(customerDetail.customer.notes || '');
      setCustDuplicateNotice(null);
    }
  }, [customerDetail]);

  const handleSaveCustomer = async (allowDuplicate = false) => {
    if (!customerDetail?.customer.id || !tenantId) return;
    setIsSavingCustomer(true);
    setCustDuplicateNotice(null);
    try {
      const res = await updateWorkshopCustomer(tenantId, customerDetail.customer.id, {
        name: custEditName.trim() || undefined,
        phone: custEditPhone.trim() || null,
        email: custEditEmail.trim() || null,
        notes: custEditNotes.trim() || null,
        allowDuplicate,
      });

      if (res.status === 'duplicate_suggestion' && res.existingCustomer) {
        setCustDuplicateNotice(res.existingCustomer);
      } else if (res.status === 'success' && res.data) {
        setFeedbackNotice({ type: 'success', text: 'Datos del cliente actualizados con éxito.' });
        loadCustomerDetail(customerDetail.customer.id);
        loadDirectoryData();
      } else {
        setFeedbackNotice({ type: 'error', text: res.message || 'Error al actualizar el cliente.' });
      }
    } catch {
      setFeedbackNotice({ type: 'error', text: 'Error de red al actualizar.' });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Vehicle Inline Edit State
  const [vehEditPlate, setVehEditPlate] = useState('');
  const [vehEditMake, setVehEditMake] = useState('');
  const [vehEditModel, setVehEditModel] = useState('');
  const [vehEditYear, setVehEditYear] = useState('');
  const [vehEditVin, setVehEditVin] = useState('');
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [vehConflictError, setVehConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (vehicleDetail?.vehicle) {
      setVehEditPlate(vehicleDetail.vehicle.plate || '');
      setVehEditMake(vehicleDetail.vehicle.make || '');
      setVehEditModel(vehicleDetail.vehicle.model || '');
      setVehEditYear(vehicleDetail.vehicle.year ? String(vehicleDetail.vehicle.year) : '');
      setVehEditVin(vehicleDetail.vehicle.vin || '');
      setVehConflictError(null);
    }
  }, [vehicleDetail]);

  const handleSaveVehicle = async () => {
    if (!vehicleDetail?.vehicle.id || !tenantId) return;
    setIsSavingVehicle(true);
    setVehConflictError(null);
    try {
      const parsedYear = vehEditYear ? parseInt(vehEditYear, 10) : null;
      const res = await updateWorkshopVehicle(tenantId, vehicleDetail.vehicle.id, {
        plate: vehEditPlate.trim().toUpperCase() || null,
        make: vehEditMake.trim() || null,
        model: vehEditModel.trim() || null,
        year: isNaN(parsedYear as number) ? null : parsedYear,
        vin: vehEditVin.trim().toUpperCase() || null,
      });

      if (res.status === 'conflict') {
        setVehConflictError(res.message || 'Conflicto: Ya existe un vehículo con esa matrícula o bastidor.');
      } else if (res.status === 'success' && res.data) {
        setFeedbackNotice({ type: 'success', text: 'Datos del vehículo actualizados con éxito.' });
        loadVehicleDetail(vehicleDetail.vehicle.id);
        loadDirectoryData();
      } else {
        setFeedbackNotice({ type: 'error', text: res.message || 'Error al actualizar el vehículo.' });
      }
    } catch {
      setFeedbackNotice({ type: 'error', text: 'Error de red al actualizar vehículo.' });
    } finally {
      setIsSavingVehicle(false);
    }
  };

  // Associate Vehicle with Customer
  const handleAssociateVehicle = async (customerId: string, vehicleId: string) => {
    if (!tenantId || !customerId || !vehicleId) return;
    try {
      const res = await associateCustomerVehicle(tenantId, { customerId, vehicleId, role: 'owner' });
      if (res.status === 'success') {
        setFeedbackNotice({ type: 'success', text: 'Vehículo asociado al cliente con éxito.' });
        setIsAssociatingVehicle(false);
        setIsAssociatingCustomer(false);
        if (selectedCustomerId) loadCustomerDetail(selectedCustomerId);
        if (selectedVehicleId) loadVehicleDetail(selectedVehicleId);
        loadDirectoryData();
      } else {
        setFeedbackNotice({ type: 'error', text: res.message || 'Error al asociar vehículo.' });
      }
    } catch {
      setFeedbackNotice({ type: 'error', text: 'Error de red al asociar.' });
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] text-slate-800">
      {/* Top Banner / Feedback Alert */}
      {feedbackNotice && (
        <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold border-b transition ${
          feedbackNotice.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-red-500 text-white border-red-600'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedbackNotice.text}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="p-1 hover:bg-black/10 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Directorio del Taller</h1>
              <p className="text-xs text-slate-500">Gestión de clientes y vehículos con datos seguros (AES-256)</p>
            </div>
          </div>
        </div>

        {/* Global Action CTAs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>Nuevo cliente</span>
          </button>
          <button
            onClick={() => {
              setInitialVehicleCustomerId(undefined);
              setIsVehicleModalOpen(true);
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir vehículo</span>
          </button>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold self-start">
          <button
            onClick={() => {
              setActiveTab('clientes');
              navigate(`/directorio?tab=clientes${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`);
            }}
            className={`px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
              activeTab === 'clientes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clientes</span>
            <span className={`px-1.5 py-0.5 rounded-full text-2xs ${
              activeTab === 'clientes' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {filteredCustomers.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('vehiculos');
              navigate(`/directorio?tab=vehiculos${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`);
            }}
            className={`px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
              activeTab === 'vehiculos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Vehículos</span>
            <span className={`px-1.5 py-0.5 rounded-full text-2xs ${
              activeTab === 'vehiculos' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {filteredVehicles.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'clientes' ? "Buscar por nombre, teléfono, matrícula..." : "Buscar por matrícula, bastidor, marca, titular..."}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* List Column */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 transition-all ${
          selectedCustomerId || selectedVehicleId ? 'hidden md:block md:w-1/2 md:max-w-xl md:border-r md:border-slate-200' : 'w-full'
        }`}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <p className="text-xs">Cargando directorio...</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No se pudo cargar el directorio</p>
                <p className="text-2xs">{errorMessage}</p>
              </div>
            </div>
          ) : activeTab === 'clientes' ? (
            /* ========================================== */
            /* TAB: CLIENTES LIST                         */
            /* ========================================== */
            filteredCustomers.length === 0 ? (
              <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl p-6">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">No hay clientes encontrados</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery ? 'Prueba con otro término de búsqueda.' : 'Crea el primer cliente del taller para comenzar.'}
                </p>
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-blue-700 transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear cliente</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomerId === cust.id;
                  const vCount = cust.vehicles?.length || 0;
                  const apptCount = cust.activitySummary?.appointmentsCount ?? 0;
                  const estCount = cust.activitySummary?.estimatesCount ?? 0;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setSelectedVehicleId(null);
                        setSelectedCustomerId(cust.id);
                      }}
                      className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:border-blue-400 hover:shadow-xs flex flex-col gap-3 ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-black flex items-center justify-center text-sm shrink-0 border border-blue-100">
                            {cust.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{cust.name}</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-2xs text-slate-500">
                              {cust.phone ? (
                                <span className="flex items-center gap-1 font-medium text-slate-700">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {cust.phone}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Sin teléfono</span>
                              )}
                              {cust.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  {cust.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-2xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                            {vCount} {vCount === 1 ? 'vehículo' : 'vehículos'}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>

                      {/* Associated Vehicles Plate Badges */}
                      {cust.vehicles && cust.vehicles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          {cust.vehicles.map(v => (
                            <div key={v.id} className="flex items-center gap-1.5">
                              <SpanishPlateBadge plate={v.plate} />
                              {(v.make || v.model) && (
                                <span className="text-2xs text-slate-600 font-medium truncate max-w-[120px]">
                                  {v.make} {v.model}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Activity Indicator Pills & Quick Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-2xs text-slate-500">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {apptCount} {apptCount === 1 ? 'cita' : 'citas'}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            {estCount} {estCount === 1 ? 'presupuesto' : 'presupuestos'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/agenda?new=manual&customerId=${cust.id}`)}
                            className="px-2 py-1 bg-slate-50 hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 font-bold rounded-lg transition"
                          >
                            + Cita
                          </button>
                          <button
                            onClick={() => navigate(`/presupuestos?new=manual&customerId=${cust.id}&customerName=${encodeURIComponent(cust.name)}${cust.phone ? `&customerPhone=${encodeURIComponent(cust.phone)}` : ''}`)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-lg transition"
                          >
                            + Presupuesto
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ========================================== */
            /* TAB: VEHÍCULOS LIST                        */
            /* ========================================== */
            filteredVehicles.length === 0 ? (
              <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl p-6">
                <Car className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">No hay vehículos encontrados</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery ? 'Prueba con otra matrícula, bastidor o marca.' : 'Registra el primer vehículo del taller para comenzar.'}
                </p>
                <button
                  onClick={() => setIsVehicleModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-blue-700 transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir vehículo</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVehicles.map((veh) => {
                  const isSelected = selectedVehicleId === veh.id;
                  const owner = veh.customer;

                  return (
                    <div
                      key={veh.id}
                      onClick={() => {
                        setSelectedCustomerId(null);
                        setSelectedVehicleId(veh.id);
                      }}
                      className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:border-blue-400 hover:shadow-xs flex flex-col gap-3 ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <SpanishPlateBadge plate={veh.plate} className="text-sm py-0.5" />
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">
                              {veh.make || veh.model ? `${veh.make || ''} ${veh.model || ''}`.trim() : 'Vehículo sin modelo'}
                              {veh.year ? ` (${veh.year})` : ''}
                            </h3>
                            {veh.vin && (
                              <p className="text-2xs font-mono text-slate-500 mt-0.5">
                                VIN: {veh.vin}
                              </p>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>

                      {/* Owner Link Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-2xs">
                        {owner ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <span className="text-slate-400 font-medium">Titular:</span>
                            <span className="font-bold text-blue-700 hover:underline">{owner.name}</span>
                            {owner.phone && <span className="text-slate-400">({owner.phone})</span>}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-medium text-2xs">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Sin cliente asociado
                          </span>
                        )}

                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/agenda?new=manual&vehicleId=${veh.id}`)}
                            className="px-2 py-1 bg-slate-50 hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 font-bold rounded-lg transition"
                          >
                            + Cita
                          </button>
                          <button
                            onClick={() => setQuoteVehicleOption(veh)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-lg transition"
                          >
                            + Presupuesto
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Detail Ficha Column (Drawer / Slide-over or desktop split view) */}
        {(selectedCustomerId || selectedVehicleId) && (
          <div className="flex-1 bg-white overflow-y-auto p-4 sm:p-6 border-l border-slate-200 h-full w-full md:w-1/2 flex flex-col z-20">
            {/* ========================================================= */}
            {/* FICHA DE CLIENTE                                          */}
            {/* ========================================================= */}
            {selectedCustomerId && (
              isDetailLoading || !customerDetail ? (
                <div className="flex flex-col items-center justify-center my-auto py-20 text-slate-400 gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-xs">Cargando ficha del cliente...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Ficha Header */}
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center text-lg shadow-xs">
                        {customerDetail.customer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-black text-slate-900">{customerDetail.customer.name}</h2>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-2xs font-extrabold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Cifrado AES
                          </span>
                        </div>
                        <p className="text-2xs text-slate-400 font-mono mt-0.5">ID: {customerDetail.customer.id}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedCustomerId(null);
                        setCustomerDetail(null);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
                      title="Cerrar ficha"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Actions Header Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/agenda?new=manual&customerId=${customerDetail.customer.id}`)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Nueva cita</span>
                    </button>
                    <button
                      onClick={() => navigate(`/presupuestos?new=manual&customerId=${customerDetail.customer.id}&customerName=${encodeURIComponent(customerDetail.customer.name)}${customerDetail.customer.phone ? `&customerPhone=${encodeURIComponent(customerDetail.customer.phone)}` : ''}`)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>Nuevo presupuesto</span>
                    </button>
                  </div>

                  {/* Customer Edit Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Datos de Contacto</span>
                      </h4>
                      {custDuplicateNotice && (
                        <span className="text-2xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          Aviso de duplicado
                        </span>
                      )}
                    </div>

                    {custDuplicateNotice && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-2xs">
                            Ya existe otro cliente con este teléfono: <strong>{custDuplicateNotice.name}</strong> ({custDuplicateNotice.phone}). ¿Deseas guardar de todos modos?
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                          <button
                            type="button"
                            onClick={() => handleSaveCustomer(true)}
                            disabled={isSavingCustomer}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-2xs transition"
                          >
                            Guardar de todos modos
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustDuplicateNotice(null)}
                            className="px-2.5 py-1 bg-white border border-amber-300 text-amber-800 rounded-lg font-bold text-2xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Nombre completo</label>
                        <input
                          type="text"
                          value={custEditName}
                          onChange={e => setCustEditName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Teléfono móvil</label>
                        <input
                          type="text"
                          value={custEditPhone}
                          onChange={e => setCustEditPhone(e.target.value)}
                          placeholder="600123456"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Correo electrónico</label>
                        <input
                          type="email"
                          value={custEditEmail}
                          onChange={e => setCustEditEmail(e.target.value)}
                          placeholder="cliente@ejemplo.com"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Notas internas de taller</label>
                        <textarea
                          rows={2}
                          value={custEditNotes}
                          onChange={e => setCustEditNotes(e.target.value)}
                          placeholder="Preferencias de contacto o notas operativas..."
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => handleSaveCustomer(false)}
                        disabled={isSavingCustomer}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
                      >
                        {isSavingCustomer ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>

                  {/* Associated Vehicles Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-blue-600" />
                        <span>Vehículos del Cliente ({customerDetail.vehicles.length})</span>
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setInitialVehicleCustomerId(customerDetail.customer.id);
                            setIsVehicleModalOpen(true);
                          }}
                          className="text-2xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Registrar nuevo</span>
                        </button>
                        <button
                          onClick={() => setIsAssociatingVehicle(!isAssociatingVehicle)}
                          className="text-2xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1"
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span>Vincular existente</span>
                        </button>
                      </div>
                    </div>

                    {isAssociatingVehicle && (
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-2">
                        <select
                          value={associationSelectedVehicleId}
                          onChange={e => setAssociationSelectedVehicleId(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="">Selecciona un vehículo del taller...</option>
                          {vehicles
                            .filter(v => !customerDetail.vehicles.some(cv => cv.id === v.id))
                            .map(v => (
                              <option key={v.id} value={v.id}>
                                {v.plate || 'Sin matrícula'} — {v.make || ''} {v.model || ''}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={!associationSelectedVehicleId}
                          onClick={() => handleAssociateVehicle(customerDetail.customer.id, associationSelectedVehicleId)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs disabled:opacity-50"
                        >
                          Asociar
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAssociatingVehicle(false)}
                          className="p-1.5 text-slate-500 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {customerDetail.vehicles.length === 0 ? (
                      <p className="text-2xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                        Este cliente no tiene ningún vehículo asociado todavía.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {customerDetail.vehicles.map(v => (
                          <div
                            key={v.id}
                            onClick={() => {
                              setSelectedCustomerId(null);
                              setSelectedVehicleId(v.id);
                            }}
                            className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl cursor-pointer transition flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <SpanishPlateBadge plate={v.plate} />
                              <div>
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {v.make || v.model ? `${v.make || ''} ${v.model || ''}` : 'Vehículo'}
                                </p>
                                {v.year && <p className="text-2xs text-slate-500">{v.year}</p>}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Appointments History */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>Historial de Citas ({customerDetail.activity.appointments.length})</span>
                      </h4>
                    </div>

                    {customerDetail.activity.appointments.length === 0 ? (
                      <p className="text-2xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                        No hay citas registradas para este cliente.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {customerDetail.activity.appointments.map(a => (
                          <div
                            key={a.id}
                            onClick={() => navigate('/agenda')}
                            className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl cursor-pointer transition flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {new Date(a.startAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="text-2xs text-slate-500">
                                  {new Date(a.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {a.vehiclePlate && <SpanishPlateBadge plate={a.vehiclePlate} className="scale-90 origin-left" />}
                              </div>
                              <p className="text-2xs text-slate-600 mt-1 font-medium">{a.serviceIntent}</p>
                            </div>
                            <span className="text-2xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 capitalize">
                              {a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Estimates History */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Historial de Presupuestos ({customerDetail.activity.estimates.length})</span>
                      </h4>
                    </div>

                    {customerDetail.activity.estimates.length === 0 ? (
                      <p className="text-2xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                        No hay presupuestos registrados para este cliente.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {customerDetail.activity.estimates.map(e => (
                          <div
                            key={e.id}
                            onClick={() => navigate(`/presupuestos?selected=${e.id}`)}
                            className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl cursor-pointer transition flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900">{e.title || 'Presupuesto de taller'}</p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  e.provenance === 'mixed'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : e.provenance === 'rk'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {e.provenance === 'mixed' ? 'Mixto' : e.provenance === 'rk' ? 'Repair Knowledge' : 'Manual'}
                                </span>
                              </div>
                              <p className="text-2xs text-slate-500 mt-0.5">
                                {new Date(e.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-slate-900">{e.total.toFixed(2)} €</p>
                              <span className="text-2xs text-slate-500 capitalize">{e.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {/* ========================================================= */}
            {/* FICHA DE VEHÍCULO                                         */}
            {/* ========================================================= */}
            {selectedVehicleId && (
              isDetailLoading || !vehicleDetail ? (
                <div className="flex flex-col items-center justify-center my-auto py-20 text-slate-400 gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-xs">Cargando ficha del vehículo...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Ficha Header */}
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <SpanishPlateBadge plate={vehicleDetail.vehicle.plate} className="text-base py-1 px-1" />
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900">
                          {vehicleDetail.vehicle.make || vehicleDetail.vehicle.model
                            ? `${vehicleDetail.vehicle.make || ''} ${vehicleDetail.vehicle.model || ''}`.trim()
                            : 'Vehículo'}
                        </h2>
                        {vehicleDetail.vehicle.vin && (
                          <p className="text-2xs font-mono text-slate-500 mt-0.5">VIN: {vehicleDetail.vehicle.vin}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedVehicleId(null);
                        setVehicleDetail(null);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
                      title="Cerrar ficha"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Actions Header Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/agenda?new=manual&vehicleId=${vehicleDetail.vehicle.id}`)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Nueva cita</span>
                    </button>
                    <button
                      onClick={() => setQuoteVehicleOption(vehicleDetail.vehicle)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>Nuevo presupuesto</span>
                    </button>
                  </div>

                  {/* Vehicle Edit Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ficha Técnica y Matrícula</span>
                      </h4>
                    </div>

                    {vehConflictError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{vehConflictError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Matrícula (España)</label>
                        <input
                          type="text"
                          value={vehEditPlate}
                          onChange={e => setVehEditPlate(e.target.value.toUpperCase())}
                          placeholder="1234BBB"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono font-bold focus:outline-none focus:border-blue-500 uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Año de fabricación</label>
                        <input
                          type="number"
                          value={vehEditYear}
                          onChange={e => setVehEditYear(e.target.value)}
                          placeholder="2018"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Marca</label>
                        <input
                          type="text"
                          value={vehEditMake}
                          onChange={e => setVehEditMake(e.target.value)}
                          placeholder="Renault"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Modelo</label>
                        <input
                          type="text"
                          value={vehEditModel}
                          onChange={e => setVehEditModel(e.target.value)}
                          placeholder="Megane IV"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-2xs font-bold text-slate-500 mb-1">Número de bastidor (VIN)</label>
                        <input
                          type="text"
                          value={vehEditVin}
                          onChange={e => setVehEditVin(e.target.value.toUpperCase())}
                          placeholder="VF1..."
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:border-blue-500 uppercase"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleSaveVehicle}
                        disabled={isSavingVehicle}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
                      >
                        {isSavingVehicle ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>

                  {/* Associated Owner Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Cliente / Titular Asociado</span>
                      </h4>
                      <button
                        onClick={() => setIsAssociatingCustomer(!isAssociatingCustomer)}
                        className="text-2xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>{vehicleDetail.customer ? 'Cambiar titular' : 'Asociar titular'}</span>
                      </button>
                    </div>

                    {isAssociatingCustomer && (
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-2">
                        <select
                          value={associationSelectedCustomerId}
                          onChange={e => setAssociationSelectedCustomerId(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="">Selecciona un cliente del taller...</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.phone ? `(${c.phone})` : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!associationSelectedCustomerId}
                          onClick={() => handleAssociateVehicle(associationSelectedCustomerId, vehicleDetail.vehicle.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs disabled:opacity-50"
                        >
                          Vincular
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAssociatingCustomer(false)}
                          className="p-1.5 text-slate-500 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {vehicleDetail.customer ? (
                      <div
                        onClick={() => {
                          setSelectedVehicleId(null);
                          setSelectedCustomerId(vehicleDetail.customer!.id);
                        }}
                        className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl cursor-pointer transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                            {vehicleDetail.customer.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{vehicleDetail.customer.name}</p>
                            <p className="text-2xs text-slate-500 mt-0.5">
                              {vehicleDetail.customer.phone || 'Sin teléfono'} {vehicleDetail.customer.email ? `• ${vehicleDetail.customer.email}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-2xs text-blue-600 font-bold flex items-center gap-1">
                          <span>Ver ficha</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Este vehículo no tiene ningún cliente titular asociado.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAssociatingCustomer(true)}
                          className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold text-2xs hover:bg-amber-700"
                        >
                          Asociar cliente
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Appointments History */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>Historial de Citas del Vehículo ({vehicleDetail.activity.appointments.length})</span>
                      </h4>
                    </div>

                    {vehicleDetail.activity.appointments.length === 0 ? (
                      <p className="text-2xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                        No hay citas registradas para este vehículo.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {vehicleDetail.activity.appointments.map(a => (
                          <div
                            key={a.id}
                            onClick={() => navigate('/agenda')}
                            className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl cursor-pointer transition flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {new Date(a.startAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="text-2xs text-slate-500">
                                  {new Date(a.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-2xs text-slate-600 mt-1 font-medium">{a.serviceIntent}</p>
                            </div>
                            <span className="text-2xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 capitalize">
                              {a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Estimates History */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Historial de Presupuestos ({vehicleDetail.activity.estimates.length})</span>
                      </h4>
                    </div>

                    {vehicleDetail.activity.estimates.length === 0 ? (
                      <p className="text-2xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                        No hay presupuestos registrados para este vehículo.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {vehicleDetail.activity.estimates.map(e => (
                          <div
                            key={e.id}
                            onClick={() => navigate(`/presupuestos?selected=${e.id}`)}
                            className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl cursor-pointer transition flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900">{e.title || 'Presupuesto de taller'}</p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  e.provenance === 'mixed'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : e.provenance === 'rk'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {e.provenance === 'mixed' ? 'Mixto' : e.provenance === 'rk' ? 'Repair Knowledge' : 'Manual'}
                                </span>
                              </div>
                              <p className="text-2xs text-slate-500 mt-0.5">
                                {new Date(e.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-slate-900">{e.total.toFixed(2)} €</p>
                              <span className="text-2xs text-slate-500 capitalize">{e.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Manual Customer Modal */}
      <ManualCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        tenantId={tenantId}
        onCustomerCreated={(newCust) => {
          setFeedbackNotice({ type: 'success', text: `Cliente ${newCust.name} guardado con éxito.` });
          loadDirectoryData();
          setSelectedCustomerId(newCust.id);
        }}
      />

      {/* Manual Vehicle Modal */}
      <ManualVehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => {
          setIsVehicleModalOpen(false);
          setInitialVehicleCustomerId(undefined);
        }}
        tenantId={tenantId}
        initialCustomerId={initialVehicleCustomerId}
        onVehicleCreated={(newVeh) => {
          setFeedbackNotice({ type: 'success', text: `Vehículo ${newVeh.plate || 'registrado'} guardado con éxito.` });
          loadDirectoryData();
          setSelectedVehicleId(newVeh.id);
        }}
      />

      {/* Quote Chooser Modal (Manual vs Repair Knowledge) */}
      {quoteVehicleOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SpanishPlateBadge plate={quoteVehicleOption.plate} />
                <h3 className="text-sm font-bold text-slate-900">Nuevo Presupuesto</h3>
              </div>
              <button onClick={() => setQuoteVehicleOption(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              ¿Cómo deseas confeccionar el presupuesto para este vehículo?
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => {
                  const v = quoteVehicleOption;
                  setQuoteVehicleOption(null);
                  const custId = v.customer?.id || v.customerId || (vehicleDetail?.vehicle?.id === v.id ? vehicleDetail?.customer?.id : undefined) || '';
                  navigate(`/presupuestos?new=rk&vehicleId=${v.id}${v.plate ? `&plate=${encodeURIComponent(v.plate)}` : ''}${custId ? `&customerId=${custId}` : ''}`);
                }}
                className="w-full p-4 bg-blue-50/60 hover:bg-blue-100/60 border border-blue-200 rounded-xl text-left transition flex items-center justify-between group"
              >
                <div>
                  <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Con Repair Knowledge (OEM)</span>
                  </p>
                  <p className="text-2xs text-blue-700 mt-1">
                    BOM oficial de sustitución y pares de apriete según catálogo técnico.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition" />
              </button>

              <button
                onClick={() => {
                  const v = quoteVehicleOption;
                  setQuoteVehicleOption(null);
                  const custId = v.customer?.id || v.customerId || (vehicleDetail?.vehicle?.id === v.id ? vehicleDetail?.customer?.id : undefined) || '';
                  const custName = v.customer?.name || (vehicleDetail?.vehicle?.id === v.id ? vehicleDetail?.customer?.name : undefined) || '';
                  navigate(`/presupuestos?new=manual&vehicleId=${v.id}${v.plate ? `&plate=${encodeURIComponent(v.plate)}` : ''}${v.make ? `&make=${encodeURIComponent(v.make)}` : ''}${v.model ? `&model=${encodeURIComponent(v.model)}` : ''}${custId ? `&customerId=${custId}&customerName=${encodeURIComponent(custName)}` : ''}`);
                }}
                className="w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition flex items-center justify-between group"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-slate-700" />
                    <span>Presupuesto Manual de Taller</span>
                  </p>
                  <p className="text-2xs text-slate-500 mt-1">
                    Líneas libres de mano de obra y recambios valoradas por el recepcionista.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
