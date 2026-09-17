import type { BakeoffScenario } from './types.js';

export const BAKEOFF_SCENARIOS: readonly BakeoffScenario[] = [
  {
    id: 'es-basque-name-plate',
    title: 'Español local, nombre vasco y matrícula dictada',
    capabilities: ['spanish_es', 'basque_names', 'spoken_plate'],
    script: [
      'Me llamo Aitor Etxeberria.',
      'La matrícula es uno cuatro ocho nueve, ka, eme, erre.',
      'Quiero una revisión y cambio de aceite.',
      'Sí, confirmo el martes 22 a las diez.',
    ],
    expected: { customerName: 'Aitor Etxeberria', plate: '1489 KMR', finalDate: '2026-09-22T10:00:00+02:00', confirmationRequired: true },
  },
  {
    id: 'interruption-date-change',
    title: 'Interrupción y cambio de fecha antes de confirmar',
    capabilities: ['barge_in', 'date_change'],
    script: [
      'Necesito mirar un ruido al frenar.',
      'El jueves me... espera, no, el jueves no puedo.',
      'Dame mejor el viernes por la mañana.',
      'Sí, confirmo el viernes 25 a las nueve.',
    ],
    expected: { finalDate: '2026-09-25T09:00:00+02:00', confirmationRequired: true },
  },
  {
    id: 'noise-long-unstructured',
    title: 'Ruido de taller y conversación larga/desestructurada',
    capabilities: ['workshop_noise', 'long_unstructured'],
    script: [
      '[ruido de compresor] No sé explicarlo bien; empezó hace unas semanas y sólo lo hace en frío.',
      'Es el coche de mi pareja, un Golf, creo que de 2018; luego te digo la matrícula.',
      'Sobre todo quiero que lo miréis, no que cambiéis nada sin avisar.',
      'La matrícula es siete dos cero uno, ele, erre, ge. Sí, confirmo el hueco del lunes 28 a las once.',
    ],
    expected: { plate: '7201 LRG', finalDate: '2026-09-28T11:00:00+02:00', confirmationRequired: true },
  },
  {
    id: 'tool-failure-transfer',
    title: 'Fallo de tool y transferencia humana',
    capabilities: ['tool_failure', 'human_transfer'],
    script: [
      'El coche pierde líquido y necesito hablar con alguien del taller.',
      '[el backend devuelve UNAVAILABLE al consultar huecos]',
    ],
    expected: { mustTransfer: true, confirmationRequired: false },
  },
  {
    id: 'no-confirmation-no-write',
    title: 'No hay confirmación: no debe existir cita',
    capabilities: ['spanish_es'],
    script: [
      'Me viene bien el martes, pero todavía no lo confirmo.',
      'Tengo que consultarlo y volveré a llamar.',
    ],
    expected: { confirmationRequired: true },
  },
] as const;

export const INITIAL_GATE_CALLS_PER_PROVIDER = BAKEOFF_SCENARIOS.length;
export const COMPARABLE_CALLS_PER_PROVIDER = 20;
