import React from 'react';
import { useDemo } from '../../context/DemoContext';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  ArrowRight
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
    appointments,
    notifyClientVehicleReady
  } = useDemo();

  if (!demoModeActive) return null;

  const steps = [
    {
      num: 1,
      title: 'Paso 1: Consulta Entrante por WhatsApp',
      desc: 'Marta Etxebarria escribe por WhatsApp solicitando revisión de su vehículo y reportando un ruido al frenar.',
      actionLabel: 'Ver en Bandeja Multicanal',
      execute: () => setActiveSection('bandeja')
    },
    {
      num: 2,
      title: 'Paso 2: Resumen "BibendIA ha entendido"',
      desc: 'BibendIA identifica el vehículo (Seat León · 8421 LMK), detecta que falta el kilometraje y prepara el siguiente paso.',
      actionLabel: 'Ver "BibendIA ha entendido"',
      execute: () => setActiveSection('bandeja')
    },
    {
      num: 3,
      title: 'Paso 3: Consulta Autónoma de Kilometraje',
      desc: 'BibendIA pregunta por WhatsApp. Marta responde: "Unos 86.000 km". BibendIA actualiza el contexto del vehículo.',
      actionLabel: 'Ver Respuesta Registrada',
      execute: () => setActiveSection('bandeja')
    },
    {
      num: 4,
      title: 'Paso 4: Propuesta Técnica y Cálculo',
      desc: 'BibendIA calcula la revisión periódica de 86.000 km + comprobación de frenos delanteros.',
      actionLabel: 'Ver Propuesta de Cita',
      execute: () => setActiveSection('bandeja')
    },
    {
      num: 5,
      title: 'Paso 5: Propuesta de Citas (Jueves 17 / Viernes 18)',
      desc: 'BibendIA consulta disponibilidad real y ofrece dos huecos: Jueves 17 de Septiembre a las 10:30 h o Viernes 18 a las 08:30 h.',
      actionLabel: 'Agendar para Jueves 17 (10:30 h)',
      execute: () => {
        confirmMartaAppointment('2026-09-17', '10:30');
        setActiveSection('agenda');
      }
    },
    {
      num: 6,
      title: 'Paso 6: Confirmación y Registro en Agenda',
      desc: 'Marta acepta la cita. Queda agendada en la agenda del taller para el Jueves 17 de Septiembre.',
      actionLabel: 'Ver Cita en Agenda',
      execute: () => setActiveSection('agenda')
    },
    {
      num: 7,
      title: 'Paso 7: Entra al Taller & Dictado del Mecánico',
      desc: 'El coche entra al taller. Jon dicta: "Aceite y filtro cambiados. Pastillas bien, recomendar cambio de discos en 6 meses."',
      actionLabel: 'Registrar Dictado del Mecánico',
      execute: () => {
        const martaApp = appointments.find(a => a.customerId === 'c1');
        if (martaApp) {
          completeAppointmentWork(
            martaApp.id,
            'Aceite 5W30 C3 y filtro de aceite sustituidos. Discos delanteros presentan desgaste leve.',
            'Sustituir discos y pastillas delanteras en 6 meses (Marzo 2027).'
          );
        }
        setActiveSection('midia');
      }
    },
    {
      num: 8,
      title: 'Paso 8: Procesamiento Autónomo & Recomendación',
      desc: 'BibendIA marca el vehículo listo, registra la recomendación a 6 meses y prepara los partes para avisar a Marta y enviar a gestión.',
      actionLabel: 'Avisar a Marta de Coche Listo',
      execute: () => {
        notifyClientVehicleReady('c1', 'v1');
        setActiveSection('midia');
      }
    },
    {
      num: 9,
      title: 'Paso 9: Exportar a Gestión (ERP/DMS)',
      desc: 'Jon presiona [Enviar a gestión]. Se transfieren cliente, vehículo y partidas de facturación en 1 clic.',
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
      title: 'Paso 10: Impacto y Registro de Actividad',
      desc: 'Toda la gestión aparece reflejada en "Lo que BibendIA ha hecho por ti" sumando tiempo ahorrado.',
      actionLabel: 'Ver Resumen de Impacto',
      execute: () => setActiveSection('impacto')
    }
  ];

  const currentStep = steps[demoStep - 1];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-slideUp">
      <div className="bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl shadow-2xl p-4 text-slate-900 flex flex-col gap-3">
        {/* Presenter Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping"></span>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Modo Presentación Guiada</span>
            <span className="text-xs text-slate-500 font-mono">({demoStep} / 10)</span>
          </div>
          <button 
            onClick={() => setDemoModeActive(false)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
            title="Salir del Modo Demo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Info */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-extrabold flex items-center justify-center shrink-0 text-sm">
            {currentStep.num}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-900 leading-snug">{currentStep.title}</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{currentStep.desc}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={prevDemoStep}
              disabled={demoStep === 1}
              className="p-1.5 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 disabled:opacity-40 text-xs font-semibold flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Ant.
            </button>
            <button
              onClick={nextDemoStep}
              disabled={demoStep === 10}
              className="p-1.5 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 disabled:opacity-40 text-xs font-semibold flex items-center gap-1"
            >
              Sig. <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              currentStep.execute();
              if (demoStep < 10) nextDemoStep();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
          >
            <span>{currentStep.actionLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

