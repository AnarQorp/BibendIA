import React, { createContext, useContext, useState } from 'react';
import {
  NavSection,
  Customer,
  Vehicle,
  Conversation,
  Appointment,
  Quote,
  FollowUpOpportunity,
  AiImpactLog
} from '../types';

export interface CommandResult {
  title: string;
  subtitle: string;
  targetVehicle?: Vehicle;
  targetCustomer?: Customer;
  wants?: string;
  slots?: { date: string; time: string; label: string }[];
  actionLabel?: string;
  actionFn?: () => void;
  infoMessage?: string;
}

export interface DemoContextType {
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;

  // Data lists
  customers: Customer[];
  vehicles: Vehicle[];
  conversations: Conversation[];
  appointments: Appointment[];
  quotes: Quote[];
  followups: FollowUpOpportunity[];
  impactLogs: AiImpactLog[];

  // Stats summary (Fixed realistic economic metrics)
  stats: {
    timeSavedHoursMinutes: string;
    managedQuotesTotal: number;
    recoveredRevenue: number;
    inquiriesHandled: number;
    appointmentsBooked: number;
    quotesPrepared: number;
    followupsDone: number;
    recoveredClients: number;
  };

  // Voice & Assistant state
  isListening: boolean;
  voiceQuery: string;
  assistantModalOpen: boolean;
  setAssistantModalOpen: (open: boolean) => void;
  activeCommandResult: CommandResult | null;
  clearCommandResult: () => void;
  startVoiceInput: () => void;
  stopVoiceInput: () => void;
  submitNaturalLanguageQuery: (query: string) => void;

  // Guided Demo Mode (Guarded by compile-time flag __DEMO_ENABLED__)
  demoFeatureEnabled: boolean;
  demoModeActive: boolean;
  setDemoModeActive: (active: boolean) => void;
  demoStep: number;
  nextDemoStep: () => void;
  prevDemoStep: () => void;
  resetDemoStep: () => void;

  // Mobile responsive sidebar drawer state
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;

  // State Mutators
  approveQuote: (quoteId: string) => void;
  updateQuote: (quote: Quote) => void;
  addQuote: (quote: Quote) => void;
  deleteQuote: (quoteId: string) => void;
  sendChatMessage: (conversationId: string, content: string) => void;
  confirmAppointmentSlot: (slotDate: string, slotTime: string) => void;
  completeAppointmentWork: (appointmentId: string, notes: string, futureRecommendation?: string) => void;
  notifyClientVehicleReady: (customerId: string, vehicleId: string) => void;
  sendAppointmentToDMS: (appointmentId: string) => void;
  sendFollowUp: (followupId: string) => void;
  generateQuoteFromPrompt: (prompt: string) => void;
  resetAllState: () => void;
}

declare const __DEMO_ENABLED__: boolean;

export const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const ProductWorkshopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSection, setActiveSection] = useState<NavSection>('midia');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const toggleMobileSidebar = () => setMobileSidebarOpen(prev => !prev);

  const handleSetActiveSection = (section: NavSection) => {
    setActiveSection(section);
    setMobileSidebarOpen(false);
  };

  // Product mode: 100% clean of synthetic mock datasets
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // Quotes state initialized from localStorage with realistic starter draft if empty
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bibendia_workshop_quotes');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Error reading saved quotes:', e);
      }
    }
    return [
      {
        id: 'q-sample-1',
        number: 'PRE-2026-001',
        customerId: '',
        vehicleId: '',
        title: 'Mantenimiento Periódico y Revisión de Frenos',
        createdDate: 'Hoy',
        status: 'draft',
        customerName: 'Ander García',
        vehiclePlate: '4821-KMP',
        items: [
          { id: 'item-1', category: 'part', description: 'Pastillas de freno delanteras (Juego)', quantity: 1, unitPrice: 65.0, total: 65.0 },
          { id: 'item-2', category: 'part', description: 'Líquido de frenos DOT 4 (1L)', quantity: 1, unitPrice: 14.5, total: 14.5 },
          { id: 'item-3', category: 'labor', description: 'Mano de obra: sustitución y purgado', quantity: 1.5, unitPrice: 50.0, total: 75.0 },
        ],
        subtotal: 154.5,
        tax: 32.45,
        total: 186.95,
        estimatedLaborHours: 1.5,
        aiRationale: 'Componentes identificados para revisión preventiva de frenado.'
      }
    ];
  });
  const [followups, setFollowups] = useState<FollowUpOpportunity[]>([]);
  const [impactLogs, setImpactLogs] = useState<AiImpactLog[]>([]);

  const persistQuotes = (updatedQuotes: Quote[]) => {
    setQuotes(updatedQuotes);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bibendia_workshop_quotes', JSON.stringify(updatedQuotes));
      } catch (e) {
        console.warn('Error persisting quotes:', e);
      }
    }
  };

  // Voice & Assistant modal state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceQuery, setVoiceQuery] = useState<string>('');
  const [assistantModalOpen, setAssistantModalOpen] = useState<boolean>(false);
  const [activeCommandResult, setActiveCommandResult] = useState<CommandResult | null>(null);

  const stats = {
    timeSavedHoursMinutes: '0 h 0 min',
    managedQuotesTotal: quotes.length,
    recoveredRevenue: 0,
    inquiriesHandled: 0,
    appointmentsBooked: appointments.length,
    quotesPrepared: quotes.length,
    followupsDone: 0,
    recoveredClients: 0
  };

  const approveQuote = (quoteId: string) => {
    const updated = quotes.map(q => q.id === quoteId ? { ...q, status: 'sent' as const } : q);
    persistQuotes(updated);
  };

  const updateQuote = (quote: Quote) => {
    const subtotal = quote.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const tax = Math.round(subtotal * 0.21 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const computedQuote: Quote = { ...quote, subtotal, tax, total };
    const updated = quotes.map(q => q.id === quote.id ? computedQuote : q);
    persistQuotes(updated);
  };

  const addQuote = (quote: Quote) => {
    const subtotal = quote.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const tax = Math.round(subtotal * 0.21 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const computedQuote: Quote = { ...quote, subtotal, tax, total };
    const updated = [computedQuote, ...quotes];
    persistQuotes(updated);
  };

  const deleteQuote = (quoteId: string) => {
    const updated = quotes.filter(q => q.id !== quoteId);
    persistQuotes(updated);
  };

  const sendChatMessage = (conversationId: string, content: string) => {
    if (!content.trim()) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      channel: 'whatsapp' as const,
      sender: 'workshop' as const,
      senderName: 'Taller (Tú)',
      content: content.trim(),
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };
    setConversations(prev => prev.map(c => {
      if (c.id === conversationId) {
        return {
          ...c,
          lastUpdate: 'Ahora',
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    }));
  };

  const confirmAppointmentSlot = () => {
    // No-op in production mode without active demo session
  };

  const completeAppointmentWork = (appointmentId: string, notes: string, futureRecommendation?: string) => {
    setAppointments(prev => prev.map(app => {
      if (app.id === appointmentId) {
        return {
          ...app,
          status: 'completed',
          completedNotes: notes,
          futureRecommendation
        };
      }
      return app;
    }));
  };

  const notifyClientVehicleReady = () => {
    // No-op in product shell
  };

  const sendAppointmentToDMS = (appointmentId: string) => {
    setAppointments(prev => prev.map(app => app.id === appointmentId ? { ...app, status: 'sent_to_dms' } : app));
  };

  const sendFollowUp = (followupId: string) => {
    setFollowups(prev => prev.map(f => f.id === followupId ? { ...f, status: 'sent' } : f));
  };

  const generateQuoteFromPrompt = (prompt: string) => {
    const newQuote: Quote = {
      id: `q-prod-${Date.now()}`,
      number: `PRE-${Date.now().toString().slice(-4)}`,
      customerId: '',
      vehicleId: '',
      title: prompt.trim() || 'Presupuesto de intervención',
      createdDate: 'Hoy',
      status: 'pending_approval',
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      estimatedLaborHours: 1.0,
      aiRationale: 'Presupuesto creado en borrador.'
    };
    setQuotes(prev => [newQuote, ...prev]);
    setActiveSection('presupuestos');
  };

  const clearCommandResult = () => setActiveCommandResult(null);

  const submitNaturalLanguageQuery = (query: string) => {
    if (!query.trim()) return;
    generateQuoteFromPrompt(query);
    setAssistantModalOpen(false);
  };

  const startVoiceInput = () => {
    setIsListening(true);
    setVoiceQuery('Escuchando...');
  };

  const stopVoiceInput = () => setIsListening(false);

  const resetAllState = () => {
    setCustomers([]);
    setVehicles([]);
    setConversations([]);
    setAppointments([]);
    setQuotes([]);
    setFollowups([]);
    setImpactLogs([]);
    setActiveCommandResult(null);
  };

  return (
    <DemoContext.Provider
      value={{
        activeSection,
        setActiveSection: handleSetActiveSection,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        toggleMobileSidebar,
        customers,
        vehicles,
        conversations,
        appointments,
        quotes,
        followups,
        impactLogs,
        stats,
        isListening,
        voiceQuery,
        assistantModalOpen,
        setAssistantModalOpen,
        activeCommandResult,
        clearCommandResult,
        startVoiceInput,
        stopVoiceInput,
        submitNaturalLanguageQuery,
        demoFeatureEnabled: false,
        demoModeActive: false,
        setDemoModeActive: () => {},
        demoStep: 1,
        nextDemoStep: () => {},
        prevDemoStep: () => {},
        resetDemoStep: () => {},
        approveQuote,
        updateQuote,
        addQuote,
        deleteQuote,
        sendChatMessage,
        confirmAppointmentSlot,
        completeAppointmentWork,
        notifyClientVehicleReady,
        sendAppointmentToDMS,
        sendFollowUp,
        generateQuoteFromPrompt,
        resetAllState
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

// Lazy loader for demo mode: ONLY resolved at compile time if __DEMO_ENABLED__ is true
const LazyDemoProvider = (typeof __DEMO_ENABLED__ !== 'undefined' && __DEMO_ENABLED__)
  ? React.lazy(() => import('../demo/InteractiveDemoProvider'))
  : null;

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof __DEMO_ENABLED__ !== 'undefined' && __DEMO_ENABLED__ && LazyDemoProvider) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-sans text-sm">Cargando BibendIA Demo...</div>}>
        <LazyDemoProvider>{children}</LazyDemoProvider>
      </React.Suspense>
    );
  }
  return <ProductWorkshopProvider>{children}</ProductWorkshopProvider>;
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
