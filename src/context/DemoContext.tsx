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
import { 
  INITIAL_CUSTOMERS, 
  INITIAL_VEHICLES, 
  INITIAL_CONVERSATIONS, 
  INITIAL_APPOINTMENTS, 
  INITIAL_QUOTES, 
  INITIAL_FOLLOWUPS, 
  INITIAL_IMPACT_LOGS 
} from '../data/mockData';

interface DemoContextType {
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
  
  // Stats summary
  stats: {
    timeSavedHoursMinutes: string;
    revenueRecovered: number;
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
  startVoiceInput: () => void;
  stopVoiceInput: () => void;
  submitNaturalLanguageQuery: (query: string) => void;
  
  // Guided Demo Mode (Discrete / Hidden)
  demoModeActive: boolean;
  setDemoModeActive: (active: boolean) => void;
  demoStep: number;
  nextDemoStep: () => void;
  prevDemoStep: () => void;
  resetDemoStep: () => void;
  
  // State Mutators
  approveQuote: (quoteId: string) => void;
  sendQuoteToClient: (quoteId: string) => void;
  confirmMartaAppointment: (slotDate: string, slotTime: string) => void;
  completeAppointmentWork: (appointmentId: string, notes: string, futureRecommendation?: string) => void;
  sendAppointmentToDMS: (appointmentId: string) => void;
  sendFollowUp: (followupId: string) => void;
  generateQuoteFromPrompt: (prompt: string) => void;
  resetAllState: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSection, setActiveSection] = useState<NavSection>('midia');
  
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [quotes, setQuotes] = useState<Quote[]>(INITIAL_QUOTES);
  const [followups, setFollowups] = useState<FollowUpOpportunity[]>(INITIAL_FOLLOWUPS);
  const [impactLogs, setImpactLogs] = useState<AiImpactLog[]>(INITIAL_IMPACT_LOGS);
  
  // Voice assistant state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceQuery, setVoiceQuery] = useState<string>('');
  const [assistantModalOpen, setAssistantModalOpen] = useState<boolean>(false);
  
  // Hidden Demo Mode state
  const [demoModeActive, setDemoModeActive] = useState<boolean>(false);
  const [demoStep, setDemoStep] = useState<number>(1);
  
  // Computed stats
  const totalMinutesSaved = impactLogs.reduce((acc, log) => acc + log.timeSavedMinutes, 0);
  const hours = Math.floor(totalMinutesSaved / 60);
  const mins = totalMinutesSaved % 60;
  const timeSavedHoursMinutes = `${hours} h ${mins} min`;
  
  const revenueRecovered = impactLogs.reduce((acc, log) => acc + (log.revenueImpact || 0), 0);
  
  const stats = {
    timeSavedHoursMinutes,
    revenueRecovered,
    inquiriesHandled: 31,
    appointmentsBooked: appointments.length + 11,
    quotesPrepared: quotes.length + 7,
    followupsDone: 17,
    recoveredClients: 3
  };

  // Helper log addition
  const addImpactLog = (log: Omit<AiImpactLog, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const newLog: AiImpactLog = {
      ...log,
      id: `log-${Date.now()}`,
      timestamp: timeStr
    };
    setImpactLogs(prev => [newLog, ...prev]);
  };

  // 1. Approve Quote
  const approveQuote = (quoteId: string) => {
    setQuotes(prev => prev.map(q => {
      if (q.id === quoteId) {
        return { ...q, status: 'sent' };
      }
      return q;
    }));
    
    const targetQuote = quotes.find(q => q.id === quoteId);
    if (targetQuote) {
      addImpactLog({
        title: `Presupuesto ${targetQuote.number} aprobado y enviado`,
        details: `Enviado por WhatsApp al cliente. Importe: ${targetQuote.total.toFixed(2)} €`,
        category: 'quote',
        timeSavedMinutes: 15,
        revenueImpact: targetQuote.total
      });
    }
  };

  // 2. Send Quote
  const sendQuoteToClient = (quoteId: string) => {
    approveQuote(quoteId);
  };

  // 3. Confirm Marta Appointment
  const confirmMartaAppointment = (slotDate: string, slotTime: string) => {
    // Add Marta's confirmed appointment
    const newApp: Appointment = {
      id: `app-marta-${Date.now()}`,
      customerId: 'c1',
      vehicleId: 'v1',
      serviceName: 'Revisión periódica + Diagnosis de frenos (86.000 km)',
      estimatedDurationMinutes: 75,
      date: slotDate,
      time: slotTime,
      status: 'scheduled',
      assignedMechanic: 'Jon',
      aiCreated: true
    };
    
    setAppointments(prev => [newApp, ...prev]);
    
    // Update conversation status
    setConversations(prev => prev.map(conv => {
      if (conv.id === 'conv-marta') {
        return {
          ...conv,
          status: 'resolved',
          unread: false,
          messages: [
            ...conv.messages,
            {
              id: `msg-${Date.now()}`,
              channel: 'whatsapp',
              sender: 'ai',
              senderName: 'BibendIA (Asistente Talleres Etxeberria)',
              content: `¡Perfecto Marta! Te hemos agendado la cita para el ${slotDate === '2026-09-17' ? 'Miércoles 17 de Septiembre a las 10:30' : 'Jueves 18 de Septiembre a las 08:30'}. Te enviaremos un recordatorio el día anterior.`,
              timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      }
      return conv;
    }));

    addImpactLog({
      title: 'Cita confirmada con Marta Etxebarria',
      details: `Agendada para ${slotDate} a las ${slotTime}. Seat León (8421 LMK).`,
      category: 'booking',
      timeSavedMinutes: 14,
      revenueImpact: 145.00
    });
  };

  // 4. Complete Appointment Work
  const completeAppointmentWork = (appointmentId: string, notes: string, futureRecommendation?: string) => {
    setAppointments(prev => prev.map(app => {
      if (app.id === appointmentId) {
        return {
          ...app,
          status: 'completed',
          completedNotes: notes,
          futureRecommendation: futureRecommendation
        };
      }
      return app;
    }));

    // Update vehicle future recommendation if specified
    const app = appointments.find(a => a.id === appointmentId);
    if (app && futureRecommendation) {
      setVehicles(prev => prev.map(v => {
        if (v.id === app.vehicleId) {
          return { ...v, futureRecommendation };
        }
        return v;
      }));
    }

    addImpactLog({
      title: `Trabajo finalizado: ${app?.serviceName || 'Reparación'}`,
      details: `Trabajo registrado. Recomendación guardada: "${futureRecommendation || 'Sin observaciones'}". Preparado para envío a gestión.`,
      category: 'billing',
      timeSavedMinutes: 18
    });
  };

  // 5. Send to External DMS / Management Software
  const sendAppointmentToDMS = (appointmentId: string) => {
    setAppointments(prev => prev.map(app => {
      if (app.id === appointmentId) {
        return { ...app, status: 'sent_to_dms' };
      }
      return app;
    }));

    const app = appointments.find(a => a.id === appointmentId);
    addImpactLog({
      title: `Orden exportada al Software de Gestión (DMS/ERP)`,
      details: `Sincronizados cliente, datos del vehículo (${app?.serviceName}) y partidas de facturación en programa de gestión.`,
      category: 'billing',
      timeSavedMinutes: 10
    });
  };

  // 6. Send Follow Up Opportunity
  const sendFollowUp = (followupId: string) => {
    setFollowups(prev => prev.map(f => {
      if (f.id === followupId) {
        return { ...f, status: 'sent' };
      }
      return f;
    }));

    const f = followups.find(item => item.id === followupId);
    if (f) {
      addImpactLog({
        title: `Seguimiento enviado: ${f.title}`,
        details: `Mensaje de recuperación enviado por WhatsApp. Valor estimado: ${f.potentialValue.toFixed(2)} €`,
        category: 'followup',
        timeSavedMinutes: 10,
        revenueImpact: f.potentialValue
      });
    }
  };

  // 7. Generate Quote from Natural Language Prompt
  const generateQuoteFromPrompt = (prompt: string) => {
    // Generate a quote dynamically based on prompt keywords
    const lower = prompt.toLowerCase();
    let title = 'Presupuesto Mantenimiento';
    let customerId = 'c2'; // Ander by default
    let vehicleId = 'v2';
    let parts = [
      { id: 'p1', category: 'part' as const, description: 'Juego pastillas de freno alta calidad', quantity: 1, unitPrice: 65.00, total: 65.00 },
      { id: 'p2', category: 'part' as const, description: 'Discos de freno ventilados alta disipación', quantity: 2, unitPrice: 75.00, total: 150.00 }
    ];
    let laborHours = 1.4;

    if (lower.includes('bmw') || lower.includes('ander')) {
      customerId = 'c2';
      vehicleId = 'v2';
      title = 'Discos y Pastillas Delanteras BMW 320d (Ander)';
    } else if (lower.includes('seat') || lower.includes('marta')) {
      customerId = 'c1';
      vehicleId = 'v1';
      title = 'Revisión Completa + Pastillas Seat León (Marta)';
    } else if (lower.includes('opel') || lower.includes('roberto')) {
      customerId = 'c3';
      vehicleId = 'v3';
      title = 'Cambio de Aceite 5W30 + Filtros Opel Astra (Roberto)';
      parts = [
        { id: 'p1', category: 'part' as const, description: 'Aceite Castrol EDGE 5W30 C3 (5L)', quantity: 1, unitPrice: 42.00, total: 42.00 },
        { id: 'p2', category: 'part' as const, description: 'Filtro de aceite Mann-Filter', quantity: 1, unitPrice: 12.00, total: 12.00 }
      ];
      laborHours = 0.8;
    }

    const subtotal = parts.reduce((a, b) => a + b.total, 0) + (laborHours * 50);
    const tax = subtotal * 0.21;
    const total = subtotal + tax;

    const newQuote: Quote = {
      id: `q-gen-${Date.now()}`,
      number: `PRE-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerId,
      vehicleId,
      title,
      createdDate: 'Ahora mismo',
      status: 'pending_approval',
      items: [
        ...parts,
        {
          id: 'p-labor',
          category: 'labor',
          description: `Mano de obra especializada taller (${laborHours}h)`,
          quantity: laborHours,
          unitPrice: 50.00,
          total: laborHours * 50.00
        }
      ],
      subtotal,
      tax,
      total,
      estimatedLaborHours: laborHours,
      aiRationale: `Generado automáticamente por Asistente BibendIA vía comando verbal/texto: "${prompt}". Calculado a 50,00 €/h.`
    };

    setQuotes(prev => [newQuote, ...prev]);
    setActiveSection('presupuestos');

    addImpactLog({
      title: `Presupuesto creado por IA vía dictado`,
      details: `"${prompt}" -> ${title} (${total.toFixed(2)} €). Listo para aprobación en 1 clic.`,
      category: 'quote',
      timeSavedMinutes: 20
    });
  };

  // Voice dictation logic simulation
  const startVoiceInput = () => {
    setIsListening(true);
    setVoiceQuery('Escuchando...');
    
    // Simulate auto-transcription after 2.5 seconds
    setTimeout(() => {
      const sampleQueries = [
        "Prepárame presupuesto para discos y pastillas delanteras del BMW de Ander",
        "¿Qué citas tengo mañana por la mañana?",
        "Apunta que al Clio de Roberto hay que revisar los neumáticos en 6 meses",
        "Dale cita a Marta el miércoles a las 10:30"
      ];
      const randomQuery = sampleQueries[0]; // prioritize Ander budget
      setVoiceQuery(randomQuery);
      setIsListening(false);
    }, 2200);
  };

  const stopVoiceInput = () => {
    setIsListening(false);
  };

  const submitNaturalLanguageQuery = (query: string) => {
    if (!query.trim()) return;
    setVoiceQuery(query);
    if (query.toLowerCase().includes('presupuesto') || query.toLowerCase().includes('discos') || query.toLowerCase().includes('pastillas')) {
      generateQuoteFromPrompt(query);
      setAssistantModalOpen(false);
    } else if (query.toLowerCase().includes('cita') || query.toLowerCase().includes('marta')) {
      confirmMartaAppointment('2026-09-17', '10:30');
      setActiveSection('agenda');
      setAssistantModalOpen(false);
    } else {
      // General feedback
      addImpactLog({
        title: `Consulta IA atendida: "${query}"`,
        details: 'Consulta contextual resuelta y procesada en tiempo real.',
        category: 'reception',
        timeSavedMinutes: 5
      });
      setAssistantModalOpen(false);
    }
  };

  // Guided Demo Mode Step Navigation
  const nextDemoStep = () => setDemoStep(prev => Math.min(prev + 1, 10));
  const prevDemoStep = () => setDemoStep(prev => Math.max(prev - 1, 1));
  const resetDemoStep = () => setDemoStep(1);

  const resetAllState = () => {
    setCustomers(INITIAL_CUSTOMERS);
    setVehicles(INITIAL_VEHICLES);
    setConversations(INITIAL_CONVERSATIONS);
    setAppointments(INITIAL_APPOINTMENTS);
    setQuotes(INITIAL_QUOTES);
    setFollowups(INITIAL_FOLLOWUPS);
    setImpactLogs(INITIAL_IMPACT_LOGS);
    setDemoStep(1);
  };

  return (
    <DemoContext.Provider
      value={{
        activeSection,
        setActiveSection,
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
        startVoiceInput,
        stopVoiceInput,
        submitNaturalLanguageQuery,
        demoModeActive,
        setDemoModeActive,
        demoStep,
        nextDemoStep,
        prevDemoStep,
        resetDemoStep,
        approveQuote,
        sendQuoteToClient,
        confirmMartaAppointment,
        completeAppointmentWork,
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

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
