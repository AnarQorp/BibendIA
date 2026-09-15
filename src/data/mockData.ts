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
    notes: 'Solicitó presupuesto de frenos BMW.'
  },
  {
    id: 'c3',
    name: 'Roberto López',
    phone: '+34 645 78 90 12',
    email: 'roberto.lopez@email.es',
    notes: 'Cliente de flota personal (Opel Astra).'
  },
  {
    id: 'c4',
    name: 'Iñaki Aguirre',
    phone: '+34 633 44 55 66',
    email: 'inaki.aguirre@email.es',
    notes: 'Pendiente de confirmación kit distribución Peugeot.'
  },
  {
    id: 'c5',
    name: 'Laura Martín',
    phone: '+34 677 88 99 00',
    email: 'laura.martin@email.es',
    notes: 'VW Golf en seguimiento de presupuesto.'
  }
];

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    plate: '8421 LMK',
    brand: 'SEAT',
    model: 'León 1.5 TSI',
    year: 2019,
    kilometers: 86400,
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
        senderName: 'BibendIA (Asistente Talleres Etxeberria)',
        content: '¡Hola Marta! Claro que sí, con mucho gusto te ayudamos con la revisión y comprobación de frenos de tu Seat León. ¿Me podrías indicar aproximadamente cuántos kilómetros tiene ahora el vehículo para calcular las operaciones necesarias?',
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
    aiInterpretation: {
      detectedNeeds: ['Revisión periódica (80k-90k km)', 'Verificación de ruidos en sistema de frenada delantera'],
      missingInfo: [],
      recommendedAction: 'Proponer cita para miércoles 10:30 u 08:30 el jueves',
      suggestedSlots: [
        { date: '2026-09-17', time: '10:30', label: 'Miércoles — 10:30 (Recomendado)' },
        { date: '2026-09-18', time: '08:30', label: 'Jueves — 08:30' }
      ],
      suggestedQuote: {
        serviceName: 'Revisión periódica + Comprobación de frenos',
        parts: [
          { name: 'Aceite sintético 5W30 C3 (4.3L)', price: 48.00 },
          { name: 'Filtro de aceite OEM Seat', price: 14.50 },
          { name: 'Filtro habitáculo antipolen', price: 18.00 }
        ],
        laborHours: 1.2,
        laborRate: 50.00
      }
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
        senderName: 'BibendIA (Voz IA)',
        content: 'Respuesta asistida: Tomados datos del vehículo BMW 320d (9102 KJD). Presupuesto preparado en borrador para revisión del mecánico.',
        timestamp: '09:56'
      }
    ],
    aiInterpretation: {
      detectedNeeds: ['Sustitución de discos delanteros ventilados', 'Pastillas de freno delanteras con avisador de desgaste'],
      missingInfo: [],
      recommendedAction: 'Aprobar presupuesto de 296,45 € y enviar a Ander por WhatsApp'
    }
  },
  {
    id: 'conv-roberto',
    customerId: 'c3',
    vehicleId: 'v3',
    channel: 'web',
    status: 'ai_handling',
    unread: false,
    lastUpdate: 'Hace 2 horas',
    messages: [
      {
        id: 'msg-r1',
        channel: 'web',
        sender: 'client',
        senderName: 'Roberto López',
        content: 'Solicitud web: Cambio de aceite y filtro en Opel Astra esta semana.',
        timestamp: '08:45'
      },
      {
        id: 'msg-r2',
        channel: 'web',
        sender: 'ai',
        senderName: 'BibendIA Web Widget',
        content: 'Propuesta enviada automáticamente: Miércoles 16:00 o Jueves 09:30. Esperando confirmación del cliente.',
        timestamp: '08:46'
      }
    ],
    aiInterpretation: {
      detectedNeeds: ['Cambio de aceite 5W30 + filtro de aceite'],
      missingInfo: [],
      recommendedAction: 'Esperar selección de Roberto o confirmar telefónicamente'
    }
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'app-1',
    customerId: 'c1',
    vehicleId: 'v1',
    serviceName: 'Revisión periódica + Diagnosis de frenos',
    estimatedDurationMinutes: 75,
    date: '2026-09-17',
    time: '10:30',
    status: 'scheduled',
    assignedMechanic: 'Jon',
    aiCreated: true
  },
  {
    id: 'app-2',
    customerId: 'c3',
    vehicleId: 'v3',
    serviceName: 'Cambio de aceite + Filtro',
    estimatedDurationMinutes: 45,
    date: '2026-09-15',
    time: '11:00',
    status: 'scheduled',
    assignedMechanic: 'Iker',
    aiCreated: true
  },
  {
    id: 'app-3',
    customerId: 'c5',
    vehicleId: 'v5',
    serviceName: 'Diagnosis electrónica por testigo encendido',
    estimatedDurationMinutes: 60,
    date: '2026-09-15',
    time: '15:30',
    status: 'scheduled',
    assignedMechanic: 'Jon',
    aiCreated: false
  }
];

export const INITIAL_QUOTES: Quote[] = [
  {
    id: 'q-ander',
    number: 'PRE-2026-084',
    customerId: 'c2',
    vehicleId: 'v2',
    title: 'Discos y pastillas delanteras BMW 320d',
    createdDate: 'Hoy, 09:56',
    status: 'pending_approval',
    items: [
      { id: 'qi-1', category: 'part', description: 'Juego de discos de freno delanteros ventilados Brembo High Carbon (300mm)', quantity: 2, unitPrice: 78.50, total: 157.00 },
      { id: 'qi-2', category: 'part', description: 'Juego de pastillas de freno delanteras Ferodo OEM con sensor desgaste', quantity: 1, unitPrice: 62.00, total: 62.00 },
      { id: 'qi-3', category: 'labor', description: 'Mano de obra sustitución discos/pastillas + limpiador frenos', quantity: 1.4, unitPrice: 50.00, total: 70.00 }
    ],
    subtotal: 289.00,
    tax: 60.69,
    total: 349.69,
    estimatedLaborHours: 1.4,
    aiRationale: 'Estimación realizada con tarifas estándar del taller (50 €/h), precios de recambios con margen taller (25%) y tiempos de catálogo OEM BMW.'
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
      { id: 'qi-4', category: 'part', description: 'Kit de distribución completo Gates con bomba de agua', quantity: 1, unitPrice: 185.00, total: 185.00 },
      { id: 'qi-5', category: 'part', description: 'Líquido refrigerante orgánico 50% 5L', quantity: 1, unitPrice: 22.00, total: 22.00 },
      { id: 'qi-6', category: 'labor', description: 'Mano de obra kit distribución + purga circuito', quantity: 3.5, unitPrice: 50.00, total: 175.00 }
    ],
    subtotal: 382.00,
    tax: 80.22,
    total: 462.22,
    estimatedLaborHours: 3.5,
    aiRationale: 'Calculado según libro de tiempos Peugeot 1.2 PureTech. Enviado por WhatsApp hace 4 días.'
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
    suggestedMessage: 'Hola Iñaki, te escribo de Talleres Etxeberria para ver si pudiste revisar el presupuesto del kit de distribución para el Peugeot 308. Tenemos disponibilidad esta semana si deseas confirmarlo.',
    status: 'pending'
  },
  {
    id: 'fol-2',
    customerId: 'c3',
    vehicleId: 'v3',
    type: 'recommended_repair',
    title: 'Opel Astra — Cambio neumáticos delanteros',
    description: 'En la visita de marzo se anotó desgaste en neumáticos delanteros al 80%. Recomendado revisar en septiembre.',
    daysPending: 180,
    potentialValue: 190.00,
    suggestedMessage: 'Hola Roberto, en tu última visita a Talleres Etxeberria anotamos revisar las ruedas delanteras de tu Opel Astra este mes. ¿Quieres que te miremos fecha para comprobar la profundidad de dibujo?',
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
    suggestedMessage: 'Hola Laura, hace más de un año de la última revisión de tu VW Golf. Te recomendamos realizar el mantenimiento periódico para evitar averías mayores. ¿Te viene bien pedir cita esta semana?',
    status: 'pending'
  }
];

export const INITIAL_IMPACT_LOGS: AiImpactLog[] = [
  {
    id: 'log-1',
    timestamp: '10:41',
    title: 'Respuesta WhatsApp atendida para Marta Etxebarria',
    details: 'Solicitud de revisión interpretada, kilometraje solicitado (86.000 km) y 2 opciones de cita preparadas.',
    category: 'reception',
    timeSavedMinutes: 12,
    revenueImpact: 145.00
  },
  {
    id: 'log-2',
    timestamp: '10:21',
    title: 'Recordatorio automático enviado a Iñaki Aguirre',
    details: 'Seguimiento por WhatsApp sobre presupuesto de kit de distribución (462,22 €).',
    category: 'followup',
    timeSavedMinutes: 8,
    revenueImpact: 462.22
  },
  {
    id: 'log-3',
    timestamp: '09:58',
    title: 'Presupuesto IA generado para BMW 320d de Ander',
    details: 'Discos Brembo + Pastillas Ferodo + 1,4h mano de obra calculados automáticamente (349,69 €).',
    category: 'quote',
    timeSavedMinutes: 25,
    revenueImpact: 349.69
  },
  {
    id: 'log-4',
    timestamp: '09:34',
    title: 'Consulta web resuelta para Roberto López',
    details: 'Respuesta automática de huecos disponibles para cambio de aceite enviado por formulario web.',
    category: 'reception',
    timeSavedMinutes: 10
  },
  {
    id: 'log-5',
    timestamp: '09:12',
    title: 'Cambio de cita reprogramado para cliente',
    details: 'Reorganización automática en agenda sin interferir en los huecos prioritarios del taller.',
    category: 'booking',
    timeSavedMinutes: 15
  }
];
