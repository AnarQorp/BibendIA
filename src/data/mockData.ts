import { Customer, Vehicle, Conversation, Appointment, Quote, FollowUpOpportunity, AiImpactLog } from '../types';

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'Marta Etxebarria',
    phone: '+34 612 34 56 78',
    email: 'marta.etxebarria@email.es',
    notes: 'Cliente habitual. Cuidada puntual con revisiones.'
  },
  {
    id: 'c2',
    name: 'Ander García',
    phone: '+34 689 12 34 56',
    email: 'ander.garcia@email.es',
    notes: 'Solicitó presupuesto de sustitución frenos delanteros BMW.'
  },
  {
    id: 'c3',
    name: 'Roberto López',
    phone: '+34 645 78 90 12',
    email: 'roberto.lopez@email.es',
    notes: 'Cliente con Opel Astra.'
  },
  {
    id: 'c4',
    name: 'Iñaki Aguirre',
    phone: '+34 633 44 55 66',
    email: 'inaki.aguirre@email.es',
    notes: 'Pendiente kit distribución Peugeot 308.'
  },
  {
    id: 'c5',
    name: 'Laura Martín',
    phone: '+34 677 88 99 00',
    email: 'laura.martin@email.es',
    notes: 'VW Golf VII en seguimiento de revisión.'
  }
];

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    plate: '8421 LMK',
    brand: 'SEAT',
    model: 'León 1.5 TSI',
    year: 2019,
    kilometers: 82300,
    motorization: '1.5 TSI 130 CV',
    vin: 'VSSZZZ5FzKR094821',
    lastServiceDate: '2025-08-10'
  },
  {
    id: 'v2',
    plate: '9102 KJD',
    brand: 'BMW',
    model: 'Serie 3 320d',
    year: 2018,
    kilometers: 142000,
    motorization: '2.0d 190 CV Automatic',
    vin: 'WBA8C31000K910291',
    lastServiceDate: '2025-11-14'
  },
  {
    id: 'v3',
    plate: '4410 HBZ',
    brand: 'Opel',
    model: 'Astra Sports Tourer',
    year: 2017,
    kilometers: 118500,
    motorization: '1.6 CDTI 110 CV',
    vin: 'W0LPE8EC3HG044100',
    lastServiceDate: '2025-04-20'
  },
  {
    id: 'v4',
    plate: '1209 HDC',
    brand: 'Peugeot',
    model: '308 SW',
    year: 2016,
    kilometers: 125000,
    motorization: '1.2 PureTech 130 CV',
    vin: 'VF3LCHNYMH0120900',
    lastServiceDate: '2025-09-02'
  },
  {
    id: 'v5',
    plate: '7731 CKB',
    brand: 'Volkswagen',
    model: 'Golf VII Highline',
    year: 2019,
    kilometers: 94200,
    motorization: '2.0 TDI 150 CV DS7',
    vin: 'WVWZZZAUzKW077310',
    lastServiceDate: '2024-12-05'
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-marta',
    customerId: 'c1',
    vehicleId: 'v1',
    channel: 'whatsapp',
    status: 'needs_attention',
    unread: true,
    lastUpdate: 'Hace 12 min',
    messages: [
      {
        id: 'msg-m1',
        channel: 'whatsapp',
        sender: 'client',
        senderName: 'Marta Etxebarria',
        content: 'Hola, quería hacer la revisión del coche y últimamente me hace un ruido al frenar.',
        timestamp: '10:38'
      },
      {
        id: 'msg-m2',
        channel: 'whatsapp',
        sender: 'ai',
        senderName: 'BibendIA (Talleres Etxeberria)',
        content: '¡Hola Marta! Claro, coordinamos la revisión y comprobación de frenos de tu Seat León. ¿Me confirmas cuántos kilómetros marca el cuentakilómetros aproximadamente?',
        timestamp: '10:39'
      },
      {
        id: 'msg-m3',
        channel: 'whatsapp',
        sender: 'client',
        senderName: 'Marta Etxebarria',
        content: 'Unos 86.000 km.',
        timestamp: '10:41'
      }
    ],
    understanding: {
      wants: ['Hacer la revisión periódica', 'Comprobar ruido al frenar en el eje delantero'],
      alreadyKnows: ['Vehículo: SEAT León (8421 LMK)', 'Historial disponible', 'Último km registrado: 82.300 km'],
      missingInfo: ['Confirmar kilometraje exacto (Recibido: 86.000 km)'],
      nextStep: 'Proponer cita para el Jueves 17 a las 10:30 h o el Viernes 18 a las 08:30 h',
      autoActionNotice: '✓ BibendIA puede gestionarlo sin que intervengas.',
      confidence: 'high',
      suggestedSlots: [
        { date: '2026-09-17', time: '10:30', label: 'Jueves 17 — 10:30 h (Recomendado)', workload: 'Carga media · 1h 15m' },
        { date: '2026-09-18', time: '08:30', label: 'Viernes 18 — 08:30 h', workload: 'Carga baja · 45m' }
      ]
    }
  },
  {
    id: 'conv-ander',
    customerId: 'c2',
    vehicleId: 'v2',
    channel: 'phone',
    status: 'ai_handling',
    unread: false,
    lastUpdate: 'Hace 45 min',
    messages: [
      {
        id: 'msg-a1',
        channel: 'phone',
        sender: 'client',
        senderName: 'Ander García',
        content: 'Llamada entrante: Preguntó precio para cambiar discos y pastillas delanteras de su BMW 320d.',
        timestamp: '09:55'
      },
      {
        id: 'msg-a2',
        channel: 'phone',
        sender: 'ai',
        senderName: 'BibendIA',
        content: 'Identificado BMW 320d (9102 KJD). Presupuesto preparado en borrador para revisión rápida.',
        timestamp: '09:56'
      }
    ],
    understanding: {
      wants: ['Presupuesto de sustitución discos y pastillas delanteras'],
      alreadyKnows: ['BMW 320d 190 CV (9102 KJD)', 'Tarifa taller: 50 €/h'],
      missingInfo: [],
      nextStep: 'Aprobar presupuesto de 349,69 € y enviar a Ander por WhatsApp',
      confidence: 'high'
    }
  },
  {
    id: 'conv-noise-issue',
    customerId: 'c5',
    vehicleId: 'v5',
    channel: 'whatsapp',
    status: 'needs_attention',
    unread: true,
    lastUpdate: 'Hace 30 min',
    messages: [
      {
        id: 'msg-n1',
        channel: 'whatsapp',
        sender: 'client',
        senderName: 'Laura Martín',
        content: 'Hola Jon, tras recoger el coche ayer noto un silbido metálico extraño al acelerar en 3ª marcha.',
        timestamp: '10:15'
      }
    ],
    understanding: {
      wants: ['Consulta técnica post-reparación por ruido inusual'],
      alreadyKnows: ['VW Golf 2.0 TDI (7731 CKB)', 'Intervención entregada ayer'],
      missingInfo: ['Valoración directa de Jon en taller'],
      nextStep: 'Revisión directa por el profesional (Jon)',
      autoActionNotice: '⚠️ Excepción técnica: Requiere atención directa de Jon',
      confidence: 'needs_confirmation'
    }
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'app-1',
    customerId: 'c3',
    vehicleId: 'v3',
    serviceName: 'Cambio de aceite 5W30 + Filtro',
    estimatedDurationMinutes: 45,
    date: '2026-09-15',
    time: '11:00',
    status: 'scheduled',
    assignedMechanic: 'Iker',
    aiCreated: true,
    workloadLevel: 'low',
    slotQuality: 'optimal'
  },
  {
    id: 'app-2',
    customerId: 'c5',
    vehicleId: 'v5',
    serviceName: 'Diagnosis electrónica por testigo de motor',
    estimatedDurationMinutes: 60,
    date: '2026-09-15',
    time: '15:30',
    status: 'scheduled',
    assignedMechanic: 'Jon',
    aiCreated: false,
    workloadLevel: 'medium',
    slotQuality: 'good'
  }
];

export const INITIAL_QUOTES: Quote[] = [
  {
    id: 'q-ander',
    number: 'PRE-2026-084',
    customerId: 'c2',
    vehicleId: 'v2',
    title: 'Eje delantero: Discos y pastillas BMW 320d',
    createdDate: 'Hoy, 09:56',
    status: 'pending_approval',
    items: [
      { id: 'qi-1', category: 'part', description: 'Juego discos de freno delanteros', quantity: 2, unitPrice: 78.50, total: 157.00 },
      { id: 'qi-2', category: 'part', description: 'Juego pastillas de freno delanteras', quantity: 1, unitPrice: 62.00, total: 62.00 },
      { id: 'qi-3', category: 'part', description: 'Sensor avisador de desgaste freno delantero', quantity: 1, unitPrice: 16.00, total: 16.00 },
      { id: 'qi-4', category: 'labor', description: 'Mano de obra sustitución discos/pastillas + desengrasado', quantity: 1.4, unitPrice: 50.00, total: 70.00 }
    ],
    subtotal: 305.00,
    tax: 64.05,
    total: 369.05,
    estimatedLaborHours: 1.4,
    aiRationale: 'Estimación BibendIA basada en tarifa estándar del taller (50 €/h) e intervalo oficial de catálogo OEM BMW.'
  },
  {
    id: 'q-inaki',
    number: 'PRE-2026-082',
    customerId: 'c4',
    vehicleId: 'v4',
    title: 'Kit distribución + Bomba de agua Peugeot 308',
    createdDate: 'Hace 4 días',
    status: 'sent',
    items: [
      { id: 'qi-5', category: 'part', description: 'Kit de distribución con bomba de agua', quantity: 1, unitPrice: 185.00, total: 185.00 },
      { id: 'qi-6', category: 'part', description: 'Líquido refrigerante orgánico 50% (5L)', quantity: 1, unitPrice: 22.00, total: 22.00 },
      { id: 'qi-7', category: 'labor', description: 'Mano de obra sustitución distribución + purga', quantity: 3.5, unitPrice: 50.00, total: 175.00 }
    ],
    subtotal: 382.00,
    tax: 80.22,
    total: 462.22,
    estimatedLaborHours: 3.5,
    aiRationale: 'Calculado según tiempos oficiales Peugeot 1.2 PureTech (3,5h). Enviado por WhatsApp hace 4 días.'
  }
];

export const INITIAL_FOLLOWUPS: FollowUpOpportunity[] = [
  {
    id: 'fol-1',
    customerId: 'c4',
    vehicleId: 'v4',
    type: 'unanswered_quote',
    title: 'Peugeot 308 — Presupuesto kit distribución',
    description: 'Presupuesto de 462,22 € enviado hace 4 días sin respuesta del cliente.',
    daysPending: 4,
    potentialValue: 462.22,
    suggestedMessage: 'Hola Iñaki, te escribo de Talleres Etxeberria para ver si pudiste revisar el presupuesto del kit de distribución para el Peugeot 308. Tenemos huecos disponibles este jueves o viernes si quieres confirmarlo.',
    status: 'pending'
  },
  {
    id: 'fol-2',
    customerId: 'c3',
    vehicleId: 'v3',
    type: 'recommended_repair',
    title: 'Opel Astra — Cambio neumáticos delanteros',
    description: 'En la visita anterior se anotó desgaste en neumáticos delanteros al 80%. Recomendado revisar este mes.',
    daysPending: 180,
    potentialValue: 190.00,
    suggestedMessage: 'Hola Roberto, en tu última visita a Talleres Etxeberria anotamos revisar las ruedas delanteras de tu Opel Astra este mes. ¿Quieres que miremos fecha para comprobar la profundidad del dibujo?',
    status: 'pending'
  },
  {
    id: 'fol-3',
    customerId: 'c5',
    vehicleId: 'v5',
    type: 'upcoming_maintenance',
    title: 'VW Golf VII — Revisión anual pendiente',
    description: '14 meses transcurridos desde la última revisión registrada.',
    daysPending: 420,
    potentialValue: 165.00,
    suggestedMessage: 'Hola Laura, hace más de un año de la última revisión de tu VW Golf. Te recomendamos el mantenimiento periódico para evitar averías. ¿Te viene bien pedir cita esta semana?',
    status: 'pending'
  }
];

export const INITIAL_IMPACT_LOGS: AiImpactLog[] = [
  {
    id: 'log-1',
    timestamp: '10:41',
    title: 'Consulta atendida para Marta Etxebarria',
    details: 'BibendIA solicitó kilometraje (86.000 km) y preparó 2 propuestas de cita para el Jueves 17 y Viernes 18.',
    category: 'reception',
    timeSavedMinutes: 12
  },
  {
    id: 'log-2',
    timestamp: '10:21',
    title: 'Recordatorio automático enviado a Iñaki Aguirre',
    details: 'Seguimiento por WhatsApp sobre presupuesto de kit de distribución (462,22 €).',
    category: 'followup',
    timeSavedMinutes: 8,
    revenueImpact: 462.22,
    isRecovery: true
  },
  {
    id: 'log-3',
    timestamp: '09:58',
    title: 'Presupuesto preparado para BMW 320d de Ander',
    details: 'Discos, pastillas y sensor de freno delantero desglosados automáticamente (369,05 €).',
    category: 'quote',
    timeSavedMinutes: 25
  },
  {
    id: 'log-4',
    timestamp: '09:34',
    title: 'Consulta web resuelta para Roberto López',
    details: 'Propuesta de huecos para cambio de aceite enviada automáticamente.',
    category: 'reception',
    timeSavedMinutes: 10
  }
];
