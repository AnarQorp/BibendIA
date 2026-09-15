import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  Play, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Wrench, 
  ArrowRight,
  MessageSquare,
  Calendar,
  Database,
  TrendingUp
} from 'lucide-react';

export const GuidedDemoPlayer: React.FC = () => {
  const { 
    demoModeActive, 
    setDemoModeActive, 
    demoStep, 
    nextDemoStep, 
    prevDemoStep, 
    setActiveSection,
    confirmMartaAppointment,
    completeAppointmentWork,
    sendAppointmentToDMS,
    appointments
  } = useDemo();

  if (!demoModeActive) return null;

  const steps = [
    {
      num: 1,
      title: 'Paso 1: Recepción de Consulta WhatsApp',
      desc: 'Marta Etxebarria escribe por WhatsApp solicitando revisión y reportando un ruido al frenar.',
      actionLabel: 'Ver en Bandeja Multicanal',
      execute: () => setActiveSection('bandeja')
    },
    {
      num: 2,
      title: 'Paso 2: Interpretación IA en Tiempo Real',
      desc: 'La IA identifica a Marta (Seat León 2019 - 8421 LMK) y detecta: Revisión + Ruido de frenos. Identifica que falta el kilometraje.',
      actionLabel: 'Analizar Interpretación IA',
      execute: () => setActiveSection('bandeja')
    },
    {
      num: 3,
      title: 'Paso 3: Consulta Autónoma de Kilometraje',
      desc: 'La IA pregunta automáticamente el kilometraje. Marta responde: "Unos 86.000 km".',
      actionLabel: 'Ver Respuesta Registrada',
      execute: () => setActiveSection('bandeja')
    },
    {
      num: 4,
      title: 'Paso 4: Propuesta Inicial y Presupuesto',
      desc: 'La IA calcula 1,2 h de intervención para la revisión 86.000 km + inspección de discos y pastillas.',
      actionLabel: 'Ver propuesta técnica',
      execute: () => setActiveSection('bandeja')
    },
    {
      num: 5,
      title: 'Paso 5: Propuesta Inteligente de Cita',
      desc: 'La IA revisa la agenda del taller y propone dos huecos optimizados: Miércoles 10:30 o Jueves 08:30.',
      actionLabel: 'Seleccionar Cita (Miércoles 10:30)',
      execute: () => {
        confirmMartaAppointment('2026-09-17', '10:30');
        setActiveSection('agenda');
      }
    },
    {
      num: 6,
      title: 'Paso 6: Confirmación y Registro en Agenda',
      desc: 'Marta elige Miércoles. Cita creada automáticamente en la agenda con estimación de 75 min.',
      actionLabel: 'Ver Cita en Agenda',
      execute: () => setActiveSection('agenda')
    },
    {
      num: 7,
      title: 'Paso 7: Dictado del Mecánico al Finalizar',
      desc: 'Jon (mecánico) dicta: "Aceite y filtros hechos. Discos con desgaste, recomendar cambio en 6 meses."',
      actionLabel: 'Registrar Dictado del Mecánico',
      execute: () => {
        const martaApp = appointments.find(a => a.customerId === 'c1');
        if (martaApp) {
          completeAppointmentWork(
            martaApp.id,
            'Aceite 5W30 C3 y filtro de aceite sustituidos. Discos delanteros presentan desgaste leve/moderado.',
            'Sustituir discos y pastillas delanteras en la revisión de los 6 meses (marzo 2027).'
          );
        }
        setActiveSection('midia');
      }
    },
    {
      num: 8,
      title: 'Paso 8: Procesamiento Autónomo del Trabajo',
      desc: 'La IA registra la intervención, guarda la recomendación futura, programa el seguimiento a 6 meses y prepara los datos para facturación.',
      actionLabel: 'Ver Estado "Trabajo Terminado"',
      execute: () => setActiveSection('midia')
    },
    {
      num: 9,
      title: 'Paso 9: Exportación a Gestión y Aviso Cliente',
      desc: 'Jon presiona [Enviar a gestión]. Los datos se envían al programa de facturación/ERP del taller en 1 clic.',
      actionLabel: 'Enviar a Gestión (ERP/DMS)',
      execute: () => {
        const martaApp = appointments.find(a => a.customerId === 'c1');
        if (martaApp) {
          sendAppointmentToDMS(martaApp.id);
        }
        setActiveSection('integraciones');
      }
    },
    {
      num: 10,
      title: 'Paso 10: Impacto y ROI Visible',
      desc: 'Toda la gestión realizada aparece automáticamente en "Lo que BibendIA ha hecho por ti", contabilizando 14 min ahorrados y 145 € generados.',
      actionLabel: 'Ver Métricas de Impacto',
      execute: () => setActiveSection('impacto')
    }
  ];

  const currentStep = steps[demoStep - 1];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-slideUp">
      <div className="bg-[#131b2e]/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl shadow-2xl p-4 text-slate-100 flex flex-col gap-3">
        {/* Presenter Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Modo Presentación Guiada</span>
            <span className="text-xs text-slate-400 font-mono">({demoStep} / 10)</span>
          </div>
          <button 
            onClick={() => setDemoModeActive(false)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
            title="Salir del Modo Demo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Step Description */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-extrabold flex items-center justify-center shrink-0 text-sm">
            {currentStep.num}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white leading-snug">{currentStep.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{currentStep.desc}</p>
          </div>
        </div>

        {/* Presenter Action Bar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={prevDemoStep}
              disabled={demoStep === 1}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Ant.
            </button>
            <button
              onClick={nextDemoStep}
              disabled={demoStep === 10}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold flex items-center gap-1"
            >
              Sig. <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              currentStep.execute();
              if (demoStep < 10) nextDemoStep();
            }}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all hover:scale-[1.02]"
          >
            <span>{currentStep.actionLabel}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
