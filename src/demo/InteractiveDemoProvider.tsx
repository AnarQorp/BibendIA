import React, { useState } from 'react';
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
import { DemoContext, CommandResult } from '../context/DemoContext';

export default function InteractiveDemoProvider({ children }: { children: React.ReactNode }) {
  const [demoModeActive, setDemoModeActiveState] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<NavSection>('midia');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const toggleMobileSidebar = () => setMobileSidebarOpen(prev => !prev);

  const handleSetActiveSection = (section: NavSection) => {
    setActiveSection(section);
    setMobileSidebarOpen(false);
  };

  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [quotes, setQuotes] = useState<Quote[]>(INITIAL_QUOTES);
  const [followups, setFollowups] = useState<FollowUpOpportunity[]>(INITIAL_FOLLOWUPS);
  const [impactLogs, setImpactLogs] = useState<AiImpactLog[]>(INITIAL_IMPACT_LOGS);

  const setDemoModeActive = (active: boolean) => {
    setDemoModeActiveState(active);
    if (typeof window !== 'undefined') {
      if (active) {
        localStorage.setItem('bibendia_demo_active', 'true');
        setCustomers(INITIAL_CUSTOMERS);
        setVehicles(INITIAL_VEHICLES);
        setConversations(INITIAL_CONVERSATIONS);
        setAppointments(INITIAL_APPOINTMENTS);
        setQuotes(INITIAL_QUOTES);
        setFollowups(INITIAL_FOLLOWUPS);
        setImpactLogs(INITIAL_IMPACT_LOGS);
      } else {
        localStorage.removeItem('bibendia_demo_active');
        setCustomers([]);
        setVehicles([]);
        setConversations([]);
        setAppointments([]);
        setQuotes([]);
        setFollowups([]);
        setImpactLogs([]);
      }
    }
  };

  // Voice & Assistant state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceQuery, setVoiceQuery] = useState<string>('');
  const [assistantModalOpen, setAssistantModalOpen] = useState<boolean>(false);
  const [activeCommandResult, setActiveCommandResult] = useState<CommandResult | null>(null);

  const [demoStep, setDemoStep] = useState<number>(1);

  // Stats calculation
  const totalMinutesSaved = impactLogs.reduce((acc, log) => acc + log.timeSavedMinutes, 0);
  const hours = Math.floor(totalMinutesSaved / 60);
  const mins = totalMinutesSaved % 60;
  const timeSavedHoursMinutes = `${hours} h ${mins} min`;
  const managedQuotesTotal = quotes.reduce((acc, q) => acc + (q.total ?? 0), 0);
  const recoveredRevenue = impactLogs
    .filter(log => log.isRecovery)
    .reduce((acc, log) => acc + (log.revenueImpact || 0), 0);

  const stats = demoModeActive ? {
    timeSavedHoursMinutes: timeSavedHoursMinutes === '0 h 0 min' ? '4 h 35 min' : timeSavedHoursMinutes,
    managedQuotesTotal: managedQuotesTotal || 2480.00,
    recoveredRevenue: Math.max(680.00, recoveredRevenue),
    inquiriesHandled: 31,
    appointmentsBooked: appointments.length || 16,
    quotesPrepared: quotes.length || 9,
    followupsDone: 17,
    recoveredClients: 3
  } : {
    timeSavedHoursMinutes,
    managedQuotesTotal,
    recoveredRevenue,
    inquiriesHandled: 0,
    appointmentsBooked: appointments.length,
    quotesPrepared: quotes.length,
    followupsDone: 0,
    recoveredClients: 0
  };

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
    const targetQuote = quotes.find(q => q.id === quoteId);
    if (!targetQuote || targetQuote.status === 'sent') return;

    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: 'sent' } : q));

    addImpactLog({
      title: `Presupuesto ${targetQuote.number} enviado a cliente`,
      details: `Enviado por WhatsApp. Importe: ${targetQuote.total !== null ? `${targetQuote.total.toFixed(2)} €` : 'Precio pendiente'}`,
      category: 'quote',
      timeSavedMinutes: 15
    });
  };

  const computeQuoteTotals = (quote: Quote): Quote => {
    const hasPending = quote.items.some(
      (item) => item.unitPrice === null || item.pricingStatus === 'PENDING'
    );
    const pricedItems = quote.items.filter(
      (item) => item.unitPrice !== null && item.quantity !== null && item.pricingStatus !== 'PENDING'
    );

    if (pricedItems.length === 0 && hasPending) {
      return { ...quote, subtotal: null, tax: null, total: null };
    }

    const subtotal = pricedItems.reduce((acc, item) => {
      const q = item.quantity ?? 0;
      const u = item.unitPrice ?? 0;
      return acc + q * u;
    }, 0);
    const roundedSubtotal = Math.round(subtotal * 100) / 100;
    const tax = Math.round(roundedSubtotal * 0.21 * 100) / 100;
    const total = Math.round((roundedSubtotal + tax) * 100) / 100;
    return { ...quote, subtotal: roundedSubtotal, tax, total };
  };

  const updateQuote = (quote: Quote) => {
    const computedQuote = computeQuoteTotals(quote);
    setQuotes(prev => prev.map(q => q.id === quote.id ? computedQuote : q));
  };

  const addQuote = (quote: Quote) => {
    const computedQuote = computeQuoteTotals(quote);
    setQuotes(prev => [computedQuote, ...prev]);
  };

  const deleteQuote = (quoteId: string) => {
    setQuotes(prev => prev.filter(q => q.id !== quoteId));
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

  // 2. Confirm Marta Appointment
  const confirmAppointmentSlot = (slotDate: string, slotTime: string) => {
    const existing = appointments.find(a => a.customerId === 'c1' && a.date === slotDate && a.time === slotTime);
    if (existing) return;

    const newApp: Appointment = {
      id: `app-marta-${Date.now()}`,
      customerId: 'c1',
      vehicleId: 'v1',
      serviceName: 'Revisión periódica + Comprobación de frenos (86.000 km)',
      estimatedDurationMinutes: 75,
      date: slotDate,
      time: slotTime,
      status: 'scheduled',
      assignedMechanic: 'Jon',
      aiCreated: true,
      workloadLevel: 'medium',
      slotQuality: 'optimal'
    };

    setAppointments(prev => [newApp, ...prev]);

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
              senderName: 'BibendIA (Talleres Etxeberria)',
              content: `¡Perfecto Marta! Te confirmamos la cita para el ${slotDate === '2026-09-17' ? 'Jueves 17 de Septiembre a las 10:30 h' : 'Viernes 18 de Septiembre a las 08:30 h'}. Te enviaremos un recordatorio el día anterior.`,
              timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            }
          ]
        };
      }
      return conv;
    }));

    addImpactLog({
      title: 'Cita confirmada con Marta Etxebarria',
      details: `Agendada para ${slotDate === '2026-09-17' ? 'Jueves 17' : 'Viernes 18'} a las ${slotTime}. Seat León (8421 LMK).`,
      category: 'booking',
      timeSavedMinutes: 14
    });
  };

  // 3. Complete Appointment Work
  const completeAppointmentWork = (appointmentId: string, notes: string, futureRecommendation?: string) => {
    const targetApp = appointments.find(a => a.id === appointmentId);
    if (!targetApp || targetApp.status === 'completed' || targetApp.status === 'sent_to_dms') return;

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

    if (targetApp && futureRecommendation) {
      setVehicles(prev => prev.map(v => {
        if (v.id === targetApp.vehicleId) {
          return { ...v, futureRecommendation };
        }
        return v;
      }));
    }

    addImpactLog({
      title: `Trabajo finalizado: ${targetApp?.serviceName || 'Reparación'}`,
      details: `Trabajo registrado. Recomendación guardada: "${futureRecommendation || 'Sin observaciones'}".`,
      category: 'billing',
      timeSavedMinutes: 18
    });
  };

  // 4. Notify Client Vehicle Ready
  const notifyClientVehicleReady = (customerId: string, vehicleId: string) => {
    const cust = customers.find(c => c.id === customerId);
    const veh = vehicles.find(v => v.id === vehicleId);

    addImpactLog({
      title: `Cliente avisado por WhatsApp: Coche listo para recogida`,
      details: `Aviso automático a ${cust?.name || 'Cliente'} (${veh?.brand} ${veh?.model} - ${veh?.plate}).`,
      category: 'reception',
      timeSavedMinutes: 8
    });
  };

  // 5. Send Appointment to DMS
  const sendAppointmentToDMS = (appointmentId: string) => {
    const targetApp = appointments.find(a => a.id === appointmentId);
    if (!targetApp || targetApp.status === 'sent_to_dms') return;

    setAppointments(prev => prev.map(app => {
      if (app.id === appointmentId) {
        return { ...app, status: 'sent_to_dms' };
      }
      return app;
    }));

    addImpactLog({
      title: `Orden exportada al Software de Gestión (ERP/DMS)`,
      details: `Sincronizados cliente y trabajos de ${targetApp?.serviceName} en programa contable.`,
      category: 'billing',
      timeSavedMinutes: 10
    });
  };

  // 6. Send Follow Up Opportunity
  const sendFollowUp = (followupId: string) => {
    const targetFol = followups.find(f => f.id === followupId);
    if (!targetFol || targetFol.status === 'sent') return;

    setFollowups(prev => prev.map(f => f.id === followupId ? { ...f, status: 'sent' } : f));

    addImpactLog({
      title: `Seguimiento enviado: ${targetFol.title}`,
      details: `Mensaje de recuperación enviado por WhatsApp. Trabajo potencial: ${targetFol.potentialValue.toFixed(2)} €`,
      category: 'followup',
      timeSavedMinutes: 10,
      revenueImpact: targetFol.potentialValue,
      isRecovery: true
    });
  };

  // 7. Generate Quote from Prompt
  const generateQuoteFromPrompt = (prompt: string) => {
    const lower = prompt.toLowerCase();
    let title = 'Sustitución discos y pastillas delanteras BMW 320d';
    let customerId = 'c2';
    let vehicleId = 'v2';

    if (lower.includes('seat') || lower.includes('marta')) {
      customerId = 'c1';
      vehicleId = 'v1';
      title = 'Revisión periódica + Pastillas Seat León (Marta)';
    } else if (lower.includes('opel') || lower.includes('roberto')) {
      customerId = 'c3';
      vehicleId = 'v3';
      title = 'Cambio de aceite 5W30 + Filtro Opel Astra (Roberto)';
    }

    const existing = quotes.find(q => q.customerId === customerId && q.title === title);
    if (existing) {
      setActiveSection('presupuestos');
      return;
    }

    const items = [
      { id: 'p1', category: 'part' as const, description: 'Juego discos de freno delanteros', quantity: 2, unitPrice: 78.50, total: 157.00 },
      { id: 'p2', category: 'part' as const, description: 'Juego pastillas de freno delanteras', quantity: 1, unitPrice: 62.00, total: 62.00 },
      { id: 'p3', category: 'part' as const, description: 'Sensor avisador de desgaste freno delantero', quantity: 1, unitPrice: 16.00, total: 16.00 },
      { id: 'p4', category: 'labor' as const, description: 'Mano de obra sustitución discos/pastillas (1.4h)', quantity: 1.4, unitPrice: 50.00, total: 70.00 }
    ];

    const subtotal = items.reduce((a, b) => a + b.total, 0);
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
      items,
      subtotal,
      tax,
      total,
      estimatedLaborHours: 1.4,
      aiRationale: 'Estimación BibendIA basada en tarifa del taller (50 €/h) y tiempos de catálogo OEM.'
    };

    setQuotes(prev => [newQuote, ...prev]);
    setActiveSection('presupuestos');

    addImpactLog({
      title: `Presupuesto preparado por dictado`,
      details: `${title} (${total.toFixed(2)} €). Listo para aprobación en 1 clic.`,
      category: 'quote',
      timeSavedMinutes: 20
    });
  };

  const clearCommandResult = () => setActiveCommandResult(null);

  const submitNaturalLanguageQuery = (query: string) => {
    if (!query.trim()) return;
    const q = query.toLowerCase();

    // Command 1: "¿Qué tengo mañana?"
    if (q.includes('mañana') || q.includes('tengo mañana')) {
      const tomorrowApps = appointments.filter(a => a.date === '2026-09-16' || a.date === '2026-09-15');
      setActiveCommandResult({
        title: 'Citas y Trabajos Agendados',
        subtitle: 'Carga de trabajo para mañana en el taller',
        infoMessage: `Tienes ${tomorrowApps.length || 2} intervenciones agendadas. Carga de taller prevista: Media.`,
        actionLabel: 'Ver Agenda Completa',
        actionFn: () => {
          setActiveSection('agenda');
          setAssistantModalOpen(false);
          clearCommandResult();
        }
      });
    }
    // Command 2: "Dale cita a Roberto esta semana para cambio de aceite."
    else if (q.includes('roberto') && (q.includes('cita') || q.includes('aceite'))) {
      const robertoCust = customers.find(c => c.id === 'c3');
      const robertoVeh = vehicles.find(v => v.id === 'v3');
      setActiveCommandResult({
        title: 'He encontrado a Roberto López',
        subtitle: `${robertoVeh?.brand} ${robertoVeh?.model} · ${robertoVeh?.plate}`,
        targetCustomer: robertoCust,
        targetVehicle: robertoVeh,
        wants: 'Cambio de aceite 5W30 + Filtro',
        slots: [
          { date: '2026-09-17', time: '16:00', label: 'Jueves 17 — 16:00 h (Carga baja)' },
          { date: '2026-09-18', time: '09:30', label: 'Viernes 18 — 09:30 h (Carga óptima)' }
        ],
        actionLabel: 'Proponer Jueves 16:00 h',
        actionFn: () => {
          const newApp: Appointment = {
            id: `app-roberto-${Date.now()}`,
            customerId: 'c3',
            vehicleId: 'v3',
            serviceName: 'Cambio de aceite 5W30 + Filtro',
            estimatedDurationMinutes: 45,
            date: '2026-09-17',
            time: '16:00',
            status: 'scheduled',
            assignedMechanic: 'Iker',
            aiCreated: true,
            workloadLevel: 'low',
            slotQuality: 'optimal'
          };
          setAppointments(prev => [...prev.filter(a => a.customerId !== 'c3' || a.serviceName !== 'Cambio de aceite 5W30 + Filtro'), newApp]);
          setActiveSection('agenda');
          setAssistantModalOpen(false);
          clearCommandResult();
        }
      });
    }
    // Command 3: "Prepárame presupuesto para discos y pastillas del BMW de Ander."
    else if (q.includes('presupuesto') || q.includes('ander') || q.includes('bmw')) {
      const anderQuote = quotes.find(q => q.customerId === 'c2') || quotes[0];
      const anderCust = customers.find(c => c.id === 'c2');
      const anderVeh = vehicles.find(v => v.id === 'v2');
      setActiveCommandResult({
        title: 'Presupuesto Preparado por BibendIA',
        subtitle: `${anderVeh?.brand} ${anderVeh?.model} · ${anderVeh?.plate}`,
        targetCustomer: anderCust,
        targetVehicle: anderVeh,
        wants: 'Discos, pastillas y sensor de desgaste delantero (369,05 €)',
        actionLabel: 'Ver Presupuesto en Detalle',
        actionFn: () => {
          setActiveSection('presupuestos');
          setAssistantModalOpen(false);
          clearCommandResult();
        }
      });
    }
    // Command 4: "¿Qué presupuestos llevan más de 3 días esperando?"
    else if (q.includes('esperando') || q.includes('3 días') || q.includes('más de 3')) {
      const pendingMore3Days = followups.filter(f => f.daysPending >= 3);
      setActiveCommandResult({
        title: 'Presupuestos Pendientes (+3 días)',
        subtitle: `${pendingMore3Days.length} presupuestos sin respuesta del cliente`,
        infoMessage: `Peugeot 308 (Iñaki Aguirre) — 462,22 € enviado hace 4 días sin respuesta.`,
        actionLabel: 'Enviar Recordatorio WhatsApp a Iñaki',
        actionFn: () => {
          sendFollowUp('fol-1');
          setActiveSection('seguimientos');
          setAssistantModalOpen(false);
          clearCommandResult();
        }
      });
    }
    // Command 5: "Avísale a Marta de que el coche está terminado."
    else if (q.includes('avísale') || q.includes('avisar') || (q.includes('marta') && q.includes('terminado'))) {
      const martaCust = customers.find(c => c.id === 'c1');
      const martaVeh = vehicles.find(v => v.id === 'v1');
      setActiveCommandResult({
        title: 'Notificación de Recogida Preparada',
        subtitle: `Marta Etxebarria · ${martaVeh?.brand} ${martaVeh?.model} (${martaVeh?.plate})`,
        targetCustomer: martaCust,
        targetVehicle: martaVeh,
        wants: 'Aviso de vehículo terminado y listo para recogida en taller',
        actionLabel: 'Enviar WhatsApp de Recogida a Marta',
        actionFn: () => {
          notifyClientVehicleReady('c1', 'v1');
          setActiveSection('midia');
          setAssistantModalOpen(false);
          clearCommandResult();
        }
      });
    }
    // Command 6: "Apunta revisar los discos de Marta dentro de 6 meses."
    else if (q.includes('apunta') || q.includes('6 meses') || (q.includes('discos') && q.includes('marta'))) {
      setActiveCommandResult({
        title: 'Recomendación Futura Guardada',
        subtitle: 'Marta Etxebarria · Seat León (8421 LMK)',
        infoMessage: 'Sustitución de discos y pastillas delanteras programada para Marzo de 2027. Se enviará un recordatorio automático.',
        actionLabel: 'Ver en Ficha del Vehículo',
        actionFn: () => {
          setVehicles(prev => prev.map(v => v.id === 'v1' ? { ...v, futureRecommendation: 'Sustituir discos y pastillas delanteras (Marzo 2027)' } : v));
          setActiveSection('midia');
          setAssistantModalOpen(false);
          clearCommandResult();
        }
      });
    }
    // Command 7: "¿Qué clientes debería contactar esta semana?"
    else if (q.includes('contactar') || q.includes('esta semana') || q.includes('clientes debería')) {
      setActiveCommandResult({
        title: 'Oportunidades de Contacto Esta Semana',
        subtitle: '3 clientes recomendados para seguimiento o revisión',
        infoMessage: '1. Iñaki (Distribución 308) · 2. Roberto (Neumáticos Astra) · 3. Laura (Revisión Golf 14 meses).',
        actionLabel: 'Ver Panel de Seguimientos',
        actionFn: () => {
          setActiveSection('seguimientos');
          setAssistantModalOpen(false);
          clearCommandResult();
        }
      });
    }
    // Command 8: "El coche de Roberto ya está terminado."
    else if (q.includes('roberto') && (q.includes('terminado') || q.includes('listo'))) {
      const robertoCust = customers.find(c => c.id === 'c3');
      const robertoVeh = vehicles.find(v => v.id === 'v3');
      setActiveCommandResult({
        title: 'Trabajo Finalizado: Opel Astra (Roberto)',
        subtitle: `${robertoVeh?.brand} ${robertoVeh?.model} · ${robertoVeh?.plate}`,
        targetCustomer: robertoCust,
        targetVehicle: robertoVeh,
        infoMessage: 'Cambio de aceite 5W30 + filtro completado. Listo para avisar al cliente y enviar a gestión.',
        actionLabel: 'Enviar a Gestión (ERP/DMS)',
        actionFn: () => {
          completeAppointmentWork('app-1', 'Cambio de aceite 5W30 C3 y filtro de aceite sustituidos.', 'Revisar neumáticos delanteros.');
          sendAppointmentToDMS('app-1');
          setActiveSection('midia');
          setAssistantModalOpen(false);
          clearCommandResult();
        }
      });
    }
    else {
      generateQuoteFromPrompt(query);
      setAssistantModalOpen(false);
    }
  };

  const startVoiceInput = () => {
    setIsListening(true);
    setVoiceQuery('Escuchando...');
    setTimeout(() => {
      const sample = "Prepárame presupuesto para discos y pastillas del BMW de Ander";
      setVoiceQuery(sample);
      setIsListening(false);
      submitNaturalLanguageQuery(sample);
    }, 2200);
  };

  const stopVoiceInput = () => setIsListening(false);

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
        demoFeatureEnabled: true,
        demoModeActive,
        setDemoModeActive,
        demoStep,
        nextDemoStep,
        prevDemoStep,
        resetDemoStep,
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
}
